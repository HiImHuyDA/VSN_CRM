import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createBooking, updateBooking, getBookingDetail, getVehicles, getDrivers, suggestLocations, resolveLocation } from '../../services/fleetApi';
import { getLocations } from '../../services/api';
import AutocompleteInput from '../../components/ui/AutocompleteInput';

const VEHICLE_TYPES = [
  'Xe công ty',
  'Máy bay',
  'Tàu hỏa',
  'Xe khách',
  'Xe thuê ngoài (Grab/Taxi)',
  'Tự túc',
];

export default function VehicleBookingNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editBookingId = searchParams.get('bookingId');
  const [submitting, setSubmitting] = useState(false);

  const userStr = localStorage.getItem('csr_user');
  let userRole = '';
  if (userStr) {
    try {
      userRole = JSON.parse(userStr).role;
    } catch {}
  }

  // System Lists
  const [systemLocations, setSystemLocations] = useState([]);
  const [vehiclesList, setVehiclesList] = useState([]);
  const [driversList, setDriversList] = useState([]);

  // Form states
  const [pickupLocation, setPickupLocation] = useState('');
  const [destination, setDestination] = useState('');
  const [stops, setStops] = useState([]); // Array of strings representing intermediate stops
  const [departureTime, setDepartureTime] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [purpose, setPurpose] = useState('');
  const [passengerCount, setPassengerCount] = useState(1);
  const [priority, setPriority] = useState('Bình thường');
  const [vehicleType, setVehicleType] = useState('Xe công ty');
  const [notes, setNotes] = useState('');

  // VIP Assign fields (Only when priority is VIP and vehicleType is Company Car)
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');

  // Accompanying participants (like hospitality)
  const [attendees, setAttendees] = useState('');
  const [attendeesEmail, setAttendeesEmail] = useState('');

  // Autocomplete suggestions states for Pickup, Destination & Stops
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [pickupShowDropdown, setPickupShowDropdown] = useState(false);
  const [destSuggestions, setDestSuggestions] = useState([]);
  const [destShowDropdown, setDestShowDropdown] = useState(false);

  const [stopsSuggestions, setStopsSuggestions] = useState({}); // { [index]: [] }
  const [stopsShowDropdown, setStopsShowDropdown] = useState({}); // { [index]: true/false }

  // Timers for nominatim autocomplete debounce
  const pickupTimer = useRef(null);
  const destTimer = useRef(null);
  const stopsTimer = useRef({});

  const pickupRef = useRef(null);
  const destRef = useRef(null);
  const stopsRefs = useRef([]);

  // Leaflet Dynamic Loading & Modal states
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [mapModalTarget, setMapModalTarget] = useState(null); // 'pickup', 'destination', index (number)
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [tempAddress, setTempAddress] = useState('');

  // Map search suggestions inside modal
  const [mapSearchSuggestions, setMapSearchSuggestions] = useState([]);
  const [mapSearchShowDropdown, setMapSearchShowDropdown] = useState(false);

  const mapRef = useRef(null);
  const mapMarkerRef = useRef(null);

  const closeAllDropdowns = () => {
    setPickupShowDropdown(false);
    setDestShowDropdown(false);
    setStopsShowDropdown({});
  };

  useEffect(() => {
    // Load Leaflet resources dynamically from CDN
    if (window.L) {
      setLeafletLoaded(true);
    } else {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => setLeafletLoaded(true);
      document.body.appendChild(script);
    }

    // Close dropdowns on outside click
    const handleOutsideClick = (e) => {
      if (pickupRef.current && !pickupRef.current.contains(e.target)) {
        setPickupShowDropdown(false);
      }
      if (destRef.current && !destRef.current.contains(e.target)) {
        setDestShowDropdown(false);
      }
      stopsRefs.current.forEach((refNode, idx) => {
        if (refNode && !refNode.contains(e.target)) {
          setStopsShowDropdown(prev => ({ ...prev, [idx]: false }));
        }
      });
    };
    document.addEventListener('mousedown', handleOutsideClick);

    // Load lists
    getLocations()
      .then(res => {
        if (res.success) {
          setSystemLocations(res.data.filter(l => l.IsActive));
        }
      })
      .catch(err => console.error('Lỗi tải địa điểm hệ thống:', err));

    getVehicles({ isActive: true, status: 'Sẵn sàng' })
      .then(res => {
        if (res.success) setVehiclesList(res.data);
      })
      .catch(err => console.error('Lỗi tải xe:', err));

    getDrivers({ isActive: true, status: 'Sẵn sàng' })
      .then(res => {
        if (res.success) setDriversList(res.data);
      })
      .catch(err => console.error('Lỗi tải tài xế:', err));

    if (editBookingId) {
      getBookingDetail(editBookingId)
        .then(res => {
          if (res.success && res.data) {
            const b = res.data;
            setPickupLocation(b.PickupLocation || '');
            setDestination(b.Destination || '');
            setStops(b.Stops ? JSON.parse(b.Stops) : []);
            setDepartureTime(b.DepartureTime ? b.DepartureTime.substring(0, 16) : '');
            setReturnTime(b.ReturnTime ? b.ReturnTime.substring(0, 16) : '');
            setPurpose(b.Purpose || '');
            setPassengerCount(b.PassengerCount || 1);
            setPriority(b.Priority || 'Bình thường');
            setVehicleType(b.VehicleType || 'Xe công ty');
            setNotes(b.Notes || '');
            setAttendees(b.Attendees || '');
            setAttendeesEmail(b.AttendeesEmail || '');
            setSelectedVehicleId(b.VehicleId || '');
            setSelectedDriverId(b.DriverId || '');
          }
        })
        .catch(err => {
          console.error('Lỗi tải chi tiết đơn sửa:', err);
          toast.error('Không thể tải chi tiết đơn cần sửa');
        });
    }

    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [editBookingId]);

  // Leaflet Modal initialization
  useEffect(() => {
    if (mapModalOpen && leafletLoaded) {
      setTimeout(() => {
        const mapEl = document.getElementById('leaflet-map');
        if (!mapEl) return;

        // Initialize Map
        const initialCoords = [10.7769, 106.7009]; // HCMC
        const map = window.L.map('leaflet-map').setView(initialCoords, 13);
        mapRef.current = map;

        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Pre-fill map search query & coordinates if target has address value
        let currentVal = '';
        if (mapModalTarget === 'pickup') currentVal = pickupLocation;
        else if (mapModalTarget === 'destination') currentVal = destination;
        else if (typeof mapModalTarget === 'number') currentVal = stops[mapModalTarget];

        if (currentVal) {
          setMapSearchQuery(currentVal);
          geocodeSearch(currentVal, map);
        } else {
          setMapSearchQuery('');
          setTempAddress('');
        }

        // On map click handler
        map.on('click', (e) => {
          const { lat, lng } = e.latlng;
          setMarkerPosition(lat, lng, map);
        });
      }, 100);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        mapMarkerRef.current = null;
      }
    };
  }, [mapModalOpen, leafletLoaded]);

  // Leaflet marker setting & reverse geocoding (accept Vietnamese lang)
  const setMarkerPosition = async (lat, lng, mapInstance) => {
    const map = mapInstance || mapRef.current;
    if (!map) return;

    if (mapMarkerRef.current) {
      mapMarkerRef.current.setLatLng([lat, lng]);
    } else {
      mapMarkerRef.current = window.L.marker([lat, lng], { draggable: true }).addTo(map);
      mapMarkerRef.current.on('dragend', () => {
        const pos = mapMarkerRef.current.getLatLng();
        setMarkerPosition(pos.lat, pos.lng, map);
      });
    }

    map.panTo([lat, lng]);

    // Nominatim Reverse Geocoding API with Vietnamese language
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=vi`);
      const data = await res.json();
      if (data.display_name) {
        setTempAddress(data.display_name);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const geocodeSearch = async (query, map) => {
    try {
      const res = await resolveLocation({ address: query });
      if (res.success && res.data) {
        const { lat, lon, address } = res.data;
        setTempAddress(address);
        setMarkerPosition(parseFloat(lat), parseFloat(lon), map);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMapSearch = async () => {
    if (!mapSearchQuery.trim() || !mapRef.current) return;
    try {
      const res = await resolveLocation({ address: mapSearchQuery });
      if (res.success && res.data) {
        const { lat, lon, address } = res.data;
        setTempAddress(address);
        setMarkerPosition(parseFloat(lat), parseFloat(lon), mapRef.current);
      } else {
        toast.error('Không tìm thấy địa điểm này trên bản đồ');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmMapSelection = () => {
    if (!tempAddress) {
      toast.error('Vui lòng chọn một điểm trên bản đồ');
      return;
    }

    if (mapModalTarget === 'pickup') {
      setPickupLocation(tempAddress);
    } else if (mapModalTarget === 'destination') {
      setDestination(tempAddress);
    } else if (typeof mapModalTarget === 'number') {
      const updated = [...stops];
      updated[mapModalTarget] = tempAddress;
      setStops(updated);
    }

    setMapModalOpen(false);
  };

  const openMapPicker = (target) => {
    if (!leafletLoaded) {
      toast.error('Thư viện bản đồ đang tải. Vui lòng thử lại sau vài giây.');
      return;
    }
    closeAllDropdowns();
    setMapModalTarget(target);
    setMapModalOpen(true);
  };

  // Simple local cache for geocoding queries
  const suggestionCache = useRef({});

  // Resolve coordinates helper using backend geocode resolve API
  const resolveAddress = async (item) => {
    try {
      if (item.lat && item.lon && !item.placeId) {
        return { lat: parseFloat(item.lat), lon: parseFloat(item.lon), address: item.value };
      }
      const res = await resolveLocation({ placeId: item.placeId || '', address: item.value });
      if (res.success && res.data) {
        return {
          lat: parseFloat(res.data.lat),
          lon: parseFloat(res.data.lon),
          address: res.data.address
        };
      }
    } catch (err) {
      console.error('Error resolving address:', err);
    }
    return null;
  };

  // Autocomplete suggestion helper consuming backend API
  const searchAddress = async (val, onSuccess, onShow) => {
    const trimmed = val.trim();
    const presets = systemLocations.map(l => ({ label: `🏢 ${l.Name} (Hệ thống)`, value: l.Name }));

    if (!trimmed) {
      onSuccess(presets);
      onShow(presets.length > 0);
      return;
    }

    // Filter system locations matching search query
    const matchingSystem = systemLocations
      .filter(l => l.Name.toLowerCase().includes(trimmed.toLowerCase()))
      .map(l => ({ label: `🏢 ${l.Name} (Hệ thống)`, value: l.Name }));

    if (trimmed.length < 3) {
      onSuccess(matchingSystem);
      onShow(matchingSystem.length > 0);
      return;
    }

    const cacheKey = trimmed.toLowerCase();
    if (suggestionCache.current[cacheKey]) {
      onSuccess(suggestionCache.current[cacheKey]);
      onShow(suggestionCache.current[cacheKey].length > 0);
      return;
    }

    try {
      const res = await suggestLocations(trimmed);
      if (res.success && Array.isArray(res.data)) {
        suggestionCache.current[cacheKey] = res.data;
        onSuccess(res.data);
        onShow(res.data.length > 0);
      } else {
        onSuccess(matchingSystem);
        onShow(matchingSystem.length > 0);
      }
    } catch (e) {
      console.error('Error fetching suggest geocode:', e);
      onSuccess(matchingSystem);
      onShow(matchingSystem.length > 0);
    }
  };

  const handlePickupChange = (e) => {
    const val = e.target.value;
    setPickupLocation(val);
    setDestShowDropdown(false);
    setStopsShowDropdown({});

    clearTimeout(pickupTimer.current);
    pickupTimer.current = setTimeout(() => {
      searchAddress(val, setPickupSuggestions, setPickupShowDropdown);
    }, 500);
  };

  const handleDestChange = (e) => {
    const val = e.target.value;
    setDestination(val);
    setPickupShowDropdown(false);
    setStopsShowDropdown({});

    clearTimeout(destTimer.current);
    destTimer.current = setTimeout(() => {
      searchAddress(val, setDestSuggestions, setDestShowDropdown);
    }, 500);
  };

  const handlePickupFocus = () => {
    setDestShowDropdown(false);
    setStopsShowDropdown({});
    searchAddress(pickupLocation, setPickupSuggestions, setPickupShowDropdown);
  };

  const handleDestFocus = () => {
    setPickupShowDropdown(false);
    setStopsShowDropdown({});
    searchAddress(destination, setDestSuggestions, setDestShowDropdown);
  };

  const handleSelectPickup = async (item) => {
    setPickupLocation(item.value);
    setPickupShowDropdown(false);

    // Proactively resolve coordinates and cache it in SQL Server
    resolveAddress(item).catch(() => { });
  };

  const handleSelectDest = async (item) => {
    setDestination(item.value);
    setDestShowDropdown(false);

    // Proactively resolve coordinates and cache it in SQL Server
    resolveAddress(item).catch(() => { });
  };

  const handleAddStop = () => {
    setStops([...stops, '']);
  };

  const handleRemoveStop = (index) => {
    setStops(stops.filter((_, i) => i !== index));
    stopsRefs.current = stopsRefs.current.filter((_, i) => i !== index);
  };

  const handleStopChange = (index, value) => {
    const updated = [...stops];
    updated[index] = value;
    setStops(updated);

    setPickupShowDropdown(false);
    setDestShowDropdown(false);
    setStopsShowDropdown(prev => ({ [index]: prev[index] }));

    clearTimeout(stopsTimer.current[index]);
    stopsTimer.current[index] = setTimeout(() => {
      searchAddress(value,
        (merged) => {
          setStopsSuggestions(prev => ({ ...prev, [index]: merged }));
          setStopsShowDropdown(prev => ({ ...prev, [index]: merged.length > 0 }));
        },
        (show) => {
          setStopsShowDropdown(prev => ({ ...prev, [index]: show }));
        }
      );
    }, 500);
  };

  const handleStopFocus = (index) => {
    setPickupShowDropdown(false);
    setDestShowDropdown(false);
    setStopsShowDropdown({});

    const val = stops[index] || '';
    searchAddress(val,
      (merged) => {
        setStopsSuggestions(prev => ({ ...prev, [index]: merged }));
        setStopsShowDropdown(prev => ({ ...prev, [index]: merged.length > 0 }));
      },
      (show) => {
        setStopsShowDropdown(prev => ({ ...prev, [index]: show }));
      }
    );
  };

  const handleSelectStop = async (index, item) => {
    const updated = [...stops];
    updated[index] = item.value;
    setStops(updated);
    setStopsShowDropdown(prev => ({ ...prev, [index]: false }));

    // Proactively resolve coordinates and cache it in SQL Server
    resolveAddress(item).catch(() => { });
  };

  const handleMapSearchChange = async (e) => {
    const val = e.target.value;
    setMapSearchQuery(val);

    const trimmed = val.trim();
    if (!trimmed || trimmed.length < 3) {
      setMapSearchSuggestions([]);
      setMapSearchShowDropdown(false);
      return;
    }

    const cacheKey = `map_${trimmed.toLowerCase()}`;
    if (suggestionCache.current[cacheKey]) {
      setMapSearchSuggestions(suggestionCache.current[cacheKey]);
      setMapSearchShowDropdown(suggestionCache.current[cacheKey].length > 0);
      return;
    }

    try {
      const res = await suggestLocations(trimmed);
      if (res.success && Array.isArray(res.data)) {
        suggestionCache.current[cacheKey] = res.data;
        setMapSearchSuggestions(res.data);
        setMapSearchShowDropdown(res.data.length > 0);
      }
    } catch (err) {
      console.error('Error suggesting in map search:', err);
    }
  };

  const handleSelectMapSearchSuggestion = async (item) => {
    setMapSearchQuery(item.value);
    setTempAddress(item.value);
    setMapSearchShowDropdown(false);

    const coords = await resolveAddress(item);
    if (coords) {
      setTempAddress(coords.address);
      setMarkerPosition(coords.lat, coords.lon, mapRef.current);
    }
  };

  const autoSemicolon = (val, prevVal = '') => {
    if (!val) return val;
    if (val.length < prevVal.length) return val;
    const lower = val.toLowerCase();
    if (lower.endsWith('.com') || lower.endsWith('.vn')) {
      return val + '; ';
    }
    return val;
  };

  const handleAttendeeSelect = (emp) => {
    // Append to attendees name list
    const currentNames = attendees.trim();
    const newNames = currentNames ? `${currentNames}, ${emp.label}` : emp.label;
    setAttendees(newNames);

    // Append to attendees email list
    const currentEmails = attendeesEmail.trim();
    if (emp.email) {
      const newEmails = currentEmails ? `${currentEmails}; ${emp.email}` : emp.email;
      setAttendeesEmail(newEmails);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!pickupLocation.trim()) return toast.error('Vui lòng nhập điểm đón');
    if (!destination.trim()) return toast.error('Vui lòng nhập điểm đến');
    if (!departureTime) return toast.error('Vui lòng chọn thời gian khởi hành');
    if (!purpose.trim()) return toast.error('Vui lòng nhập mục đích di chuyển');
    if (passengerCount < 1) return toast.error('Số hành khách phải lớn hơn hoặc bằng 1');

    // Filter empty stops
    const cleanedStops = stops.map(s => s.trim()).filter(Boolean);

    setSubmitting(true);
    try {
      const payload = {
        pickupLocation,
        destination,
        stops: cleanedStops.length > 0 ? cleanedStops : null,
        departureTime,
        returnTime: returnTime || null,
        purpose,
        passengerCount,
        priority,
        vehicleType,
        notes: notes.trim() || null,
        vehicleId: priority === 'VIP' && vehicleType === 'Xe công ty' && selectedVehicleId ? parseInt(selectedVehicleId) : null,
        driverId: priority === 'VIP' && vehicleType === 'Xe công ty' && selectedDriverId ? parseInt(selectedDriverId) : null,
        attendees: attendees.trim() || null,
        attendeesEmail: attendeesEmail.trim() || null
      };

      if (editBookingId) {
        const res = await updateBooking(editBookingId, payload);
        if (res.success) {
          toast.success('Cập nhật và gửi lại yêu cầu duyệt thành công!');
          navigate('/vehicle');
        }
      } else {
        const res = await createBooking(payload);
        if (res.success) {
          if (res.data.Status === 'Team Admin đã duyệt') {
            toast.success(`Đã tự động phê duyệt & phân xe cho chuyến đi VIP! Mã: ${res.data.BookingCode}`);
          } else {
            toast.success(`Tạo yêu cầu đặt xe thành công! Mã: ${res.data.BookingCode}`);
          }
          navigate('/vehicle');
        }
      }
    } catch (err) {
      toast.error(err.message || 'Lỗi khi gửi yêu cầu đặt xe');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-on-surface mb-1">{editBookingId ? 'Chỉnh Sửa Yêu Cầu Xe Công Tác' : 'Tạo Yêu Cầu Xe Công Tác'}</h1>
        </div>
        <button
          onClick={() => navigate('/vehicle')}
          className="btn btn-outline btn-sm"
        >
          Quay lại danh sách
        </button>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Lịch trình di chuyển */}
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-bold text-primary border-b border-border pb-2 mb-1">📍 Thông Tin Lộ Trình</h3>

            {/* Pickup Input with Autocomplete suggestions */}
            <div className="form-group" ref={pickupRef}>
              <label>Điểm đón khách (Pickup) <span className="text-danger">*</span></label>
              <div className="flex gap-2 items-center">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Nhập địa chỉ hoặc chọn địa điểm hệ thống..."
                    value={pickupLocation}
                    onChange={handlePickupChange}
                    onFocus={handlePickupFocus}
                    autoComplete="off"
                    required
                  />
                  {pickupShowDropdown && pickupSuggestions.length > 0 && (
                    <div className="autocomplete-dropdown">
                      {pickupSuggestions.map((item, idx) => (
                        <div
                          key={idx}
                          className="autocomplete-item"
                          onMouseDown={() => handleSelectPickup(item)}
                        >
                          <span className="autocomplete-name">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => openMapPicker('pickup')}
                  className="btn btn-ghost p-2"
                  title="Chọn từ bản đồ"
                  style={{ height: '38px', width: '38px', minWidth: '38px', borderRadius: '8px' }}
                >
                  <span className="material-symbols-outlined text-[18px]">map</span>
                </button>
              </div>
            </div>

            {/* Các điểm dừng trung gian */}
            <div className="form-group">
              <div className="flex justify-between items-center mb-1">
                <label className="mb-0">Các điểm dừng dọc đường (nếu có)</label>
                <button
                  type="button"
                  onClick={handleAddStop}
                  className="text-xs text-primary font-semibold flex items-center gap-0.5 hover:underline"
                >
                  <span className="material-symbols-outlined text-[14px]">add_circle</span>
                  Thêm điểm dừng
                </button>
              </div>

              {stops.map((stop, idx) => (
                <div key={idx} className="flex gap-2 mb-2 items-center" ref={el => stopsRefs.current[idx] = el}>
                  <span className="text-xs text-on-surface-variant font-semibold min-w-[50px]">Điểm {idx + 1}:</span>
                  <div className="flex-1 flex gap-2 items-center">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder={`Địa chỉ điểm dừng thứ ${idx + 1}`}
                        value={stop}
                        onChange={e => handleStopChange(idx, e.target.value)}
                        onFocus={() => handleStopFocus(idx)}
                        autoComplete="off"
                      />
                      {stopsShowDropdown[idx] && stopsSuggestions[idx]?.length > 0 && (
                        <div className="autocomplete-dropdown">
                          {stopsSuggestions[idx].map((item, keyIdx) => (
                            <div
                              key={keyIdx}
                              className="autocomplete-item"
                              onMouseDown={() => handleSelectStop(idx, item)}
                            >
                              <span className="autocomplete-name">{item.label}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => openMapPicker(idx)}
                      className="btn btn-ghost p-2"
                      title="Chọn từ bản đồ"
                      style={{ height: '38px', width: '38px', minWidth: '38px', borderRadius: '8px' }}
                    >
                      <span className="material-symbols-outlined text-[18px]">map</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveStop(idx)}
                    className="text-danger p-1 hover:bg-red-50 rounded"
                    title="Xóa điểm dừng này"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              ))}
            </div>

            {/* Destination Input with Autocomplete suggestions */}
            <div className="form-group" ref={destRef}>
              <label>Điểm đến chính (Destination) <span className="text-danger">*</span></label>
              <div className="flex gap-2 items-center">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Nhập địa chỉ hoặc chọn địa điểm nhà máy..."
                    value={destination}
                    onChange={handleDestChange}
                    onFocus={handleDestFocus}
                    autoComplete="off"
                    required
                  />
                  {destShowDropdown && destSuggestions.length > 0 && (
                    <div className="autocomplete-dropdown">
                      {destSuggestions.map((item, idx) => (
                        <div
                          key={idx}
                          className="autocomplete-item"
                          onMouseDown={() => handleSelectDest(item)}
                        >
                          <span className="autocomplete-name">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => openMapPicker('destination')}
                  className="btn btn-ghost p-2"
                  title="Chọn từ bản đồ"
                  style={{ height: '38px', width: '38px', minWidth: '38px', borderRadius: '8px' }}
                >
                  <span className="material-symbols-outlined text-[18px]">map</span>
                </button>
              </div>
            </div>
          </div>

          {/* Thời gian và Yêu cầu xe */}
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-bold text-primary border-b border-border pb-2 mb-1">📅 Thời Gian & Phương Tiện</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="form-group">
                <label>Thời gian khởi hành <span className="text-danger">*</span></label>
                <input
                  type="datetime-local"
                  value={departureTime}
                  onChange={e => setDepartureTime(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Thời gian về (dự kiến)</label>
                <input
                  type="datetime-local"
                  value={returnTime}
                  onChange={e => setReturnTime(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="form-group">
                <label>Loại phương tiện</label>
                <select value={vehicleType} onChange={e => setVehicleType(e.target.value)}>
                  {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Số người đi cùng <span className="text-danger">*</span></label>
                <input
                  type="number"
                  min="1"
                  value={passengerCount}
                  onChange={e => setPassengerCount(parseInt(e.target.value) || 1)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Độ ưu tiên chuyến đi</label>
                <select value={priority} onChange={e => setPriority(e.target.value)}>
                  <option value="Bình thường">Bình thường</option>
                  <option value="Khẩn">⚠️ Khẩn cấp</option>
                  <option value="VIP">🌟 VIP</option>
                </select>
              </div>
            </div>

            {/* VIP Assign Fields: Display when Priority is VIP and Vehicle Type is Company Car */}
            {priority === 'VIP' && vehicleType === 'Xe công ty' && (
              <div className="p-4 bg-yellow-50/50 border border-yellow-200 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-yellow-800 tracking-wider uppercase">🌟 Phân Xe Đặc Quyền VIP (Duyệt Nhanh)</h4>

                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="text-xs font-semibold">Chọn xe công tác <span className="text-danger">*</span></label>
                    <select
                      value={selectedVehicleId}
                      onChange={e => setSelectedVehicleId(e.target.value)}
                    >
                      <option value="">-- Chọn xe sẵn sàng --</option>
                      {vehiclesList.map(v => (
                        <option key={v.Id} value={v.Id}>{v.PlateNumber} - {v.Brand} ({v.Seats} chỗ)</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="text-xs font-semibold">Chọn tài xế lái xe</label>
                    <select
                      value={selectedDriverId}
                      onChange={e => setSelectedDriverId(e.target.value)}
                    >
                      <option value="">-- Tự lái / Để trống --</option>
                      {driversList.map(d => (
                        <option key={d.Id} value={d.Id}>{d.FullName} ({d.Phone || '—'})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Mục đích chuyến đi (Purpose) <span className="text-danger">*</span></label>
              <textarea
                rows="3"
                placeholder="Nêu rõ mục đích công tác, đưa đón khách hàng, phục vụ công việc gì..."
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                required
              />
            </div>
          </div>

        </div>

        {/* Accompanying participants section (accompanying list like hospitality) */}
        <div className="border-t border-border pt-4 space-y-4">
          <h3 className="text-sm font-bold text-primary">👥 Người Tham Gia Đi Cùng (phía VSN)</h3>

          <div className="form-group">
            <label>Tìm kiếm nhân viên để thêm vào danh sách</label>
            <AutocompleteInput
              value=""
              onChange={() => { }}
              onSelect={handleAttendeeSelect}
              placeholder="Gõ tên nhân viên để thêm nhanh..."
              clearAfterSelect
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label>Danh sách người đi cùng (ngăn cách bởi dấu phẩy)</label>
              <input
                type="text"
                placeholder="Nguyễn Văn A, Trần Thị B..."
                value={attendees}
                onChange={e => setAttendees(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Email người đi cùng (ngăn cách bởi dấu chấm phẩy)</label>
              <input
                type="text"
                placeholder="a@vietsun.com; b@vietsun.com..."
                value={attendeesEmail}
                onChange={e => {
                  const newVal = autoSemicolon(e.target.value, attendeesEmail);
                  setAttendeesEmail(newVal);
                }}
              />
            </div>
          </div>
        </div>

        {/* Thông tin bổ sung */}
        <div className="form-group border-t border-border pt-4">
          <label>Ghi chú thêm cho bộ phận điều phối (nếu có)</label>
          <textarea
            rows="2"
            placeholder="Yêu cầu riêng về tài xế, hành lý đặc biệt đi kèm hoặc các lưu ý khác..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigate('/vehicle')}
            disabled={submitting}
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            className="btn btn-primary min-w-[150px]"
            disabled={submitting}
          >
            {submitting ? 'Đang gửi...' : editBookingId ? 'Lưu Thay Đổi' : 'Gửi yêu cầu'}
          </button>
        </div>
      </form>

      {/* --- LEAFLET MAP MODAL POPUP --- */}
      {mapModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMapModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden z-10 flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-base text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[20px]">pin_drop</span>
                Chọn Địa Điểm Trên Bản Đồ
              </h3>
              <button
                type="button"
                className="text-on-surface-variant hover:text-on-surface"
                onClick={() => setMapModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 flex flex-col gap-3">
              {/* Search Bar on Map */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Nhập địa chỉ cần tìm kiếm..."
                    value={mapSearchQuery}
                    onChange={handleMapSearchChange}
                    onKeyDown={e => e.key === 'Enter' && handleMapSearch()}
                    autoComplete="off"
                    style={{ width: '100%' }}
                  />
                  {mapSearchShowDropdown && mapSearchSuggestions.length > 0 && (
                    <div className="autocomplete-dropdown">
                      {mapSearchSuggestions.map((item, idx) => (
                        <div
                          key={idx}
                          className="autocomplete-item"
                          onMouseDown={() => handleSelectMapSearchSuggestion(item)}
                        >
                          <span className="autocomplete-name">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleMapSearch}
                  className="btn btn-primary btn-sm flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">search</span>
                  Tìm kiếm
                </button>
              </div>

              {/* Map Canvas */}
              <div
                id="leaflet-map"
                className="w-full rounded-xl border border-border bg-gray-50 relative"
                style={{ height: '350px', zIndex: 1 }}
              >
                {/* Fallback loader */}
                {!leafletLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                    <span className="material-symbols-outlined animate-spin text-[24px] mr-2">refresh</span>
                    Đang tải bản đồ...
                  </div>
                )}
              </div>

              {/* Display selected address */}
              <div className="p-3 bg-gray-50 border border-border rounded-lg text-xs font-medium min-h-[46px] flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">location_on</span>
                <span className="text-on-surface">{tempAddress || 'Chưa chọn vị trí. Vui lòng bấm lên bản đồ để cắm mốc tọa độ.'}</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex justify-end gap-2 bg-gray-50">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setMapModalOpen(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm min-w-[120px]"
                onClick={handleConfirmMapSelection}
                disabled={!tempAddress}
              >
                Xác nhận vị trí
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
