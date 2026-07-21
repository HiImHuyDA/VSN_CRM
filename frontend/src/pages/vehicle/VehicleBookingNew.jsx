import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createBooking, updateBooking, getBookingDetail, getVehicles, getDrivers, suggestLocations, resolveLocation, getVehicleCalendar } from '../../services/fleetApi';
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
  const [vehicleSchedules, setVehicleSchedules] = useState([]); // Busy schedules in target dates

  // Form Step
  const [currentStep, setCurrentStep] = useState(1);
  const [isRoundTrip, setIsRoundTrip] = useState(false);

  // Form states (Step 1 - General & Leg 1 Departure Info)
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

  // Accompanying participants (accompanying list like hospitality)
  const [attendees, setAttendees] = useState('');
  const [attendeesEmail, setAttendeesEmail] = useState('');

  // Leg 2 (Return Trip) states - conditional on isRoundTrip
  const [returnPickupLocation, setReturnPickupLocation] = useState('');
  const [returnDestination, setReturnDestination] = useState('');
  const [returnStops, setReturnStops] = useState([]);
  const [returnPassengerCount, setReturnPassengerCount] = useState(1);
  const [returnPriority, setReturnPriority] = useState('Bình thường');
  const [returnVehicleType, setReturnVehicleType] = useState('Xe công ty');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnVehicleId, setReturnVehicleId] = useState('');
  const [returnDriverId, setReturnDriverId] = useState('');
  const [returnAttendees, setReturnAttendees] = useState('');
  const [returnAttendeesEmail, setReturnAttendeesEmail] = useState('');

  // Auto-sync return pickup & destination from departure settings
  useEffect(() => {
    setReturnPickupLocation(destination);
    setReturnDestination(pickupLocation);
  }, [pickupLocation, destination]);

  // Autocomplete suggestions states
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [pickupShowDropdown, setPickupShowDropdown] = useState(false);
  const [destSuggestions, setDestSuggestions] = useState([]);
  const [destShowDropdown, setDestShowDropdown] = useState(false);
  const [stopsSuggestions, setStopsSuggestions] = useState({});
  const [stopsShowDropdown, setStopsShowDropdown] = useState({});

  const [returnDestSuggestions, setReturnDestSuggestions] = useState([]);
  const [returnDestShowDropdown, setReturnDestShowDropdown] = useState(false);
  const [returnStopsSuggestions, setReturnStopsSuggestions] = useState({});
  const [returnStopsShowDropdown, setReturnStopsShowDropdown] = useState({});

  // Timers for nominatim autocomplete debounce
  const pickupTimer = useRef(null);
  const destTimer = useRef(null);
  const stopsTimer = useRef({});
  const returnDestTimer = useRef(null);
  const returnStopsTimer = useRef({});

  const pickupRef = useRef(null);
  const destRef = useRef(null);
  const stopsRefs = useRef([]);
  const returnDestRef = useRef(null);
  const returnStopsRefs = useRef([]);

  // Leaflet Dynamic Loading & Modal states
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [mapModalTarget, setMapModalTarget] = useState(null); // 'pickup', 'destination', 'returnDestination', index (number), 'returnStop_' + index
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
    setReturnDestShowDropdown(false);
    setReturnStopsShowDropdown({});
  };

  // Fetch daily vehicle schedules to show busy/free intervals
  const fetchVehicleSchedules = (dateStr) => {
    if (!dateStr) return;
    const dateOnly = dateStr.slice(0, 10);
    getVehicleCalendar({ dateFrom: dateOnly, dateTo: dateOnly })
      .then(res => {
        if (res.success) {
          // Merge schedules
          setVehicleSchedules(prev => {
            const keys = new Set(res.data.map(item => item.BookingCodeNo));
            const filtered = prev.filter(item => !keys.has(item.BookingCodeNo));
            return [...filtered, ...res.data];
          });
        }
      })
      .catch(err => console.error('Lỗi tải lịch trình xe trong ngày:', err));
  };

  const getDateString = (dt) => {
    if (!dt) return '';
    const d = new Date(dt);
    if (isNaN(d.getTime())) return String(dt).slice(0, 10);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getVehicleSlotsForDate = (vehicleId, dateStr) => {
    if (!vehicleId || !dateStr) return [];
    const targetDate = getDateString(dateStr);
    return vehicleSchedules.filter(s => {
      if (s.VehicleId !== vehicleId) return false;
      const slotDate = getDateString(s.DepartureTime);
      return slotDate === targetDate;
    });
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
      if (returnDestRef.current && !returnDestRef.current.contains(e.target)) {
        setReturnDestShowDropdown(false);
      }
      returnStopsRefs.current.forEach((refNode, idx) => {
        if (refNode && !refNode.contains(e.target)) {
          setReturnStopsShowDropdown(prev => ({ ...prev, [idx]: false }));
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
            const legs = b.legs || [];
            
            setDepartureTime(b.DepartureTime ? b.DepartureTime.substring(0, 16) : '');
            setReturnTime(b.ReturnTime ? b.ReturnTime.substring(0, 16) : '');
            setIsRoundTrip(!!b.ReturnTime);
            setPurpose(b.Purpose || '');

            // Load leg 1 departure
            if (legs[0]) {
              setPickupLocation(legs[0].PickupLocation || '');
              setDestination(legs[0].Destination || '');
              setStops(legs[0].Stops ? JSON.parse(legs[0].Stops) : []);
              setPassengerCount(legs[0].PassengerCount || 1);
              setPriority(legs[0].Priority || 'Bình thường');
              setVehicleType(legs[0].VehicleType || 'Xe công ty');
              setNotes(legs[0].Notes || '');
              setAttendees(legs[0].Attendees || '');
              setAttendeesEmail(legs[0].AttendeesEmail || '');
              setSelectedVehicleId(legs[0].VehicleId || '');
              setSelectedDriverId(legs[0].DriverId || '');
            }

            // Load leg 2 return
            if (legs[1]) {
              setReturnStops(legs[1].Stops ? JSON.parse(legs[1].Stops) : []);
              setReturnPassengerCount(legs[1].PassengerCount || 1);
              setReturnPriority(legs[1].Priority || 'Bình thường');
              setReturnVehicleType(legs[1].VehicleType || 'Xe công ty');
              setReturnNotes(legs[1].Notes || '');
              setReturnAttendees(legs[1].Attendees || '');
              setReturnAttendeesEmail(legs[1].AttendeesEmail || '');
              setReturnVehicleId(legs[1].VehicleId || '');
              setReturnDriverId(legs[1].DriverId || '');
            }

            // Pre-fetch calendars if edited
            if (b.DepartureTime) fetchVehicleSchedules(b.DepartureTime);
            if (b.ReturnTime) fetchVehicleSchedules(b.ReturnTime);
          }
        })
        .catch(err => {
          console.error('Lỗi tải chi tiết đơn sửa:', err);
          toast.error('Không thể tải chi tiết đơn cần sửa');
        });
    }

    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [editBookingId]);

  // Leaflet Map Modal configuration
  useEffect(() => {
    if (mapModalOpen && leafletLoaded) {
      setTimeout(() => {
        const mapEl = document.getElementById('leaflet-map');
        if (!mapEl) return;

        const initialCoords = [10.7769, 106.7009];
        const map = window.L.map('leaflet-map').setView(initialCoords, 13);
        mapRef.current = map;

        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        let currentVal = '';
        if (mapModalTarget === 'pickup') currentVal = pickupLocation;
        else if (mapModalTarget === 'destination') currentVal = destination;
        else if (mapModalTarget === 'returnDestination') currentVal = returnDestination;
        else if (typeof mapModalTarget === 'number') currentVal = stops[mapModalTarget];
        else if (typeof mapModalTarget === 'string' && mapModalTarget.startsWith('returnStop_')) {
          const idx = parseInt(mapModalTarget.split('_')[1]);
          currentVal = returnStops[idx];
        }

        if (currentVal) {
          setMapSearchQuery(currentVal);
          geocodeSearch(currentVal, map);
        } else {
          setMapSearchQuery('');
          setTempAddress('');
        }

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
    } else if (mapModalTarget === 'returnDestination') {
      setReturnDestination(tempAddress);
    } else if (typeof mapModalTarget === 'number') {
      const updated = [...stops];
      updated[mapModalTarget] = tempAddress;
      setStops(updated);
    } else if (typeof mapModalTarget === 'string' && mapModalTarget.startsWith('returnStop_')) {
      const idx = parseInt(mapModalTarget.split('_')[1]);
      const updated = [...returnStops];
      updated[idx] = tempAddress;
      setReturnStops(updated);
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

  const suggestionCache = useRef({});

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

  const searchAddress = async (val, onSuccess, onShow) => {
    const trimmed = val.trim();
    const presets = systemLocations.map(l => ({ label: `🏢 ${l.Name} (Hệ thống)`, value: l.Name }));

    if (!trimmed) {
      onSuccess(presets);
      onShow(presets.length > 0);
      return;
    }

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
    closeAllDropdowns();

    clearTimeout(pickupTimer.current);
    pickupTimer.current = setTimeout(() => {
      searchAddress(val, setPickupSuggestions, setPickupShowDropdown);
    }, 500);
  };

  const handleDestChange = (e) => {
    const val = e.target.value;
    setDestination(val);
    closeAllDropdowns();

    clearTimeout(destTimer.current);
    destTimer.current = setTimeout(() => {
      searchAddress(val, setDestSuggestions, setDestShowDropdown);
    }, 500);
  };

  const handleReturnDestChange = (e) => {
    const val = e.target.value;
    setReturnDestination(val);
    closeAllDropdowns();

    clearTimeout(returnDestTimer.current);
    returnDestTimer.current = setTimeout(() => {
      searchAddress(val, setReturnDestSuggestions, setReturnDestShowDropdown);
    }, 500);
  };

  const handlePickupFocus = () => {
    closeAllDropdowns();
    searchAddress(pickupLocation, setPickupSuggestions, setPickupShowDropdown);
  };

  const handleDestFocus = () => {
    closeAllDropdowns();
    searchAddress(destination, setDestSuggestions, setDestShowDropdown);
  };

  const handleReturnDestFocus = () => {
    closeAllDropdowns();
    searchAddress(returnDestination, setReturnDestSuggestions, setReturnDestShowDropdown);
  };

  const handleSelectPickup = async (item) => {
    setPickupLocation(item.value);
    setPickupShowDropdown(false);
    resolveAddress(item).catch(() => { });
  };

  const handleSelectDest = async (item) => {
    setDestination(item.value);
    setDestShowDropdown(false);
    resolveAddress(item).catch(() => { });
  };

  const handleSelectReturnDest = async (item) => {
    setReturnDestination(item.value);
    setReturnDestShowDropdown(false);
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
    closeAllDropdowns();

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
    closeAllDropdowns();
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
    resolveAddress(item).catch(() => { });
  };

  // Return Stops Handlers
  const handleAddReturnStop = () => {
    setReturnStops([...returnStops, '']);
  };

  const handleRemoveReturnStop = (index) => {
    setReturnStops(returnStops.filter((_, i) => i !== index));
    returnStopsRefs.current = returnStopsRefs.current.filter((_, i) => i !== index);
  };

  const handleReturnStopChange = (index, value) => {
    const updated = [...returnStops];
    updated[index] = value;
    setReturnStops(updated);
    closeAllDropdowns();

    clearTimeout(returnStopsTimer.current[index]);
    returnStopsTimer.current[index] = setTimeout(() => {
      searchAddress(value,
        (merged) => {
          setReturnStopsSuggestions(prev => ({ ...prev, [index]: merged }));
          setReturnStopsShowDropdown(prev => ({ ...prev, [index]: merged.length > 0 }));
        },
        (show) => {
          setReturnStopsShowDropdown(prev => ({ ...prev, [index]: show }));
        }
      );
    }, 500);
  };

  const handleReturnStopFocus = (index) => {
    closeAllDropdowns();
    const val = returnStops[index] || '';
    searchAddress(val,
      (merged) => {
        setReturnStopsSuggestions(prev => ({ ...prev, [index]: merged }));
        setReturnStopsShowDropdown(prev => ({ ...prev, [index]: merged.length > 0 }));
      },
      (show) => {
        setReturnStopsShowDropdown(prev => ({ ...prev, [index]: show }));
      }
    );
  };

  const handleSelectReturnStop = async (index, item) => {
    const updated = [...returnStops];
    updated[index] = item.value;
    setReturnStops(updated);
    setReturnStopsShowDropdown(prev => ({ ...prev, [index]: false }));
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
    const currentNames = attendees.trim();
    const newNames = currentNames ? `${currentNames}, ${emp.label}` : emp.label;
    setAttendees(newNames);

    const currentEmails = attendeesEmail.trim();
    if (emp.email) {
      const newEmails = currentEmails ? `${currentEmails}; ${emp.email}` : emp.email;
      setAttendeesEmail(newEmails);
    }
  };

  const handleReturnAttendeeSelect = (emp) => {
    const currentNames = returnAttendees.trim();
    const newNames = currentNames ? `${currentNames}, ${emp.label}` : emp.label;
    setReturnAttendees(newNames);

    const currentEmails = returnAttendeesEmail.trim();
    if (emp.email) {
      const newEmails = currentEmails ? `${currentEmails}; ${emp.email}` : emp.email;
      setReturnAttendeesEmail(newEmails);
    }
  };

  // Submit flow
  const executeSubmit = async () => {
    if (!pickupLocation.trim()) return toast.error('Vui lòng nhập điểm đón');
    if (!destination.trim()) return toast.error('Vui lòng nhập điểm đến');
    if (!departureTime) return toast.error('Vui lòng chọn thời gian khởi hành');
    if (new Date(departureTime).getTime() < Date.now()) {
      return toast.error('Thời gian khởi hành không được ở trong quá khứ');
    }
    if (isRoundTrip && !returnTime) return toast.error('Vui lòng chọn thời gian về');
    if (isRoundTrip && new Date(returnTime).getTime() < new Date(departureTime).getTime()) {
      return toast.error('Thời gian về không được trước thời gian khởi hành');
    }
    if (!purpose.trim()) return toast.error('Vui lòng nhập mục đích di chuyển');

    setSubmitting(true);
    try {
      const cleanedStops = stops.map(s => s.trim()).filter(Boolean);
      const cleanedReturnStops = returnStops.map(s => s.trim()).filter(Boolean);

      const payload = {
        pickupLocation,
        destination,
        stops: cleanedStops.length > 0 ? cleanedStops : null,
        departureTime,
        returnTime: isRoundTrip && returnTime ? returnTime : null,
        purpose,
        passengerCount,
        priority,
        vehicleType,
        notes: notes.trim() || null,
        vehicleId: vehicleType === 'Xe công ty' && selectedVehicleId ? parseInt(selectedVehicleId) : null,
        driverId: vehicleType === 'Xe công ty' && selectedDriverId ? parseInt(selectedDriverId) : null,
        attendees: attendees.trim() || null,
        attendeesEmail: attendeesEmail.trim() || null,

        // Return Leg
        returnStops: isRoundTrip && cleanedReturnStops.length > 0 ? cleanedReturnStops : null,
        returnPassengerCount: isRoundTrip ? returnPassengerCount : 1,
        returnPriority: isRoundTrip ? returnPriority : 'Bình thường',
        returnVehicleType: isRoundTrip ? returnVehicleType : 'Xe công ty',
        returnAttendees: isRoundTrip && returnAttendees.trim() ? returnAttendees.trim() : null,
        returnAttendeesEmail: isRoundTrip && returnAttendeesEmail.trim() ? returnAttendeesEmail.trim() : null,
        returnNotes: isRoundTrip && returnNotes.trim() ? returnNotes.trim() : null,
        returnVehicleId: isRoundTrip && returnVehicleType === 'Xe công ty' && returnVehicleId ? parseInt(returnVehicleId) : null,
        returnDriverId: isRoundTrip && returnVehicleType === 'Xe công ty' && returnDriverId ? parseInt(returnDriverId) : null
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
          <h1 className="text-2xl font-bold text-on-surface mb-1">
            {editBookingId ? 'Chỉnh Sửa Yêu Cầu Xe Công Tác' : 'Tạo Yêu Cầu Xe Công Tác'}
          </h1>
        </div>
        <button
          onClick={() => navigate('/vehicle')}
          className="btn btn-outline btn-sm"
        >
          Quay lại danh sách
        </button>
      </div>

      {/* Steps Indicator */}
      <div className="mb-6 flex justify-between items-center bg-surface p-4 rounded-xl border border-border">
        <div className="flex items-center gap-2">
          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
            currentStep === 1 ? 'bg-primary text-white shadow' : 'bg-surface-variant text-on-surface-variant'
          }`}>1</span>
          <span className="text-sm font-semibold text-on-surface">Thông tin chung</span>
        </div>
        <div className="flex-1 h-[2px] bg-border mx-4"></div>
        <div className="flex items-center gap-2">
          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
            currentStep === 2 ? 'bg-primary text-white shadow' : 'bg-surface-variant text-on-surface-variant'
          }`}>2</span>
          <span className="text-sm font-semibold text-on-surface">Phân xe chiều đi</span>
        </div>
        {isRoundTrip && (
          <>
            <div className="flex-1 h-[2px] bg-border mx-4"></div>
            <div className="flex items-center gap-2">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                currentStep === 3 ? 'bg-primary text-white shadow' : 'bg-surface-variant text-on-surface-variant'
              }`}>3</span>
              <span className="text-sm font-semibold text-on-surface">Phân xe chiều về</span>
            </div>
          </>
        )}
      </div>

      <div className="card p-6 flex flex-col gap-6">

        {/* STEP 1: GENERAL & DEPARTURE INFORMATION */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-primary border-b border-border pb-2 mb-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">calendar_today</span>
              THẺ 1: THÔNG TIN CHUNG CHUYẾN ĐI
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Route */}
              <div className="flex flex-col gap-4">
                <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">📍 Địa Điểm</h4>
                
                {/* Pickup Location */}
                <div className="form-group" ref={pickupRef}>
                  <label>Điểm đón khách (Pickup) <span className="text-danger">*</span></label>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="Nhập địa chỉ đón..."
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

                {/* Stops */}
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
                            placeholder={`Địa chỉ điểm dừng ${idx + 1}`}
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
                        title="Xóa điểm dừng"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Destination */}
                <div className="form-group" ref={destRef}>
                  <label>Điểm đến chính (Destination) <span className="text-danger">*</span></label>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="Nhập địa chỉ đến..."
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

              {/* Right Column: Time & Purpose */}
              <div className="flex flex-col gap-4">
                <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">📅 Thời Gian & Mục Đích</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label>Thời gian khởi hành <span className="text-danger">*</span></label>
                    <input
                      type="datetime-local"
                      value={departureTime}
                      min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                      onChange={e => setDepartureTime(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="flex items-center gap-1.5 select-none">
                      <input
                        type="checkbox"
                        checked={isRoundTrip}
                        onChange={e => setIsRoundTrip(e.target.checked)}
                        className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4"
                      />
                      <span className="text-xs font-semibold text-on-surface">Yêu cầu khứ hồi</span>
                    </label>
                    {isRoundTrip && (
                      <input
                        type="datetime-local"
                        className="mt-2"
                        value={returnTime}
                        min={departureTime || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                        onChange={e => setReturnTime(e.target.value)}
                        required={isRoundTrip}
                      />
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label>Mục đích chuyến đi (Purpose) <span className="text-danger">*</span></label>
                  <textarea
                    rows="4"
                    placeholder="Nêu rõ lý do đi công tác, gặp đối tác nào, phục vụ dự án gì..."
                    value={purpose}
                    onChange={e => setPurpose(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Step 1 Actions */}
            <div className="flex justify-end gap-3 border-t border-border pt-4 mt-6">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => navigate('/vehicle')}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn btn-primary min-w-[150px]"
                onClick={() => {
                  if (!pickupLocation.trim()) return toast.error('Vui lòng nhập điểm đón');
                  if (!destination.trim()) return toast.error('Vui lòng nhập điểm đến');
                  if (!departureTime) return toast.error('Vui lòng chọn thời gian khởi hành');
                  if (new Date(departureTime).getTime() < Date.now()) {
                    return toast.error('Thời gian khởi hành không được ở trong quá khứ');
                  }
                  if (isRoundTrip && !returnTime) return toast.error('Vui lòng chọn thời gian về');
                  if (isRoundTrip && new Date(returnTime).getTime() < new Date(departureTime).getTime()) {
                    return toast.error('Thời gian về không được trước thời gian khởi hành');
                  }
                  if (!purpose.trim()) return toast.error('Vui lòng nhập mục đích di chuyển');

                  // Auto-resolve vehicle busy calendars
                  fetchVehicleSchedules(departureTime);
                  if (isRoundTrip && returnTime) {
                    fetchVehicleSchedules(returnTime);
                  }

                  setCurrentStep(2);
                }}
              >
                Tiếp tục
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: DEPARTURE VEHICLE & PARTICIPANTS */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-primary border-b border-border pb-2 mb-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">commute</span>
              THẺ 2: LỰA CHỌN PHƯƠNG TIỆN & NGƯỜI ĐI CÙNG (CHIỀU ĐI)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="form-group">
                <label>Loại phương tiện chiều đi</label>
                <select value={vehicleType} onChange={e => setVehicleType(e.target.value)}>
                  {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Số người đi cùng chiều đi <span className="text-danger">*</span></label>
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

            {/* Vexere Company Vehicle Selector Grid */}
            {vehicleType === 'Xe công ty' ? (
              <div className="space-y-3">
                <label className="font-semibold text-xs text-on-surface-variant block">🚗 CHỌN XE CÔNG TY CHIỀU ĐI</label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {vehiclesList.map(v => {
                    const isSelected = selectedVehicleId === v.Id;
                    const busySlots = getVehicleSlotsForDate(v.Id, departureTime);
                    const approvedSlots = busySlots.filter(s => s.Status === 'Team Admin đã duyệt');
                    const bookedPassengers = approvedSlots.reduce((sum, s) => sum + (Number(s.PassengerCount) || 0), 0);
                    const totalSeats = Number(v.Seats) || 0;
                    const remainingSeats = Math.max(0, totalSeats - bookedPassengers);
                    
                    return (
                      <div
                        key={v.Id}
                        onClick={() => setSelectedVehicleId(isSelected ? '' : v.Id)}
                        className={`cursor-pointer p-4 rounded-xl border transition-all duration-300 flex flex-col justify-between ${
                          isSelected
                            ? 'border-primary bg-primary/5 shadow-md scale-[1.01]'
                            : 'border-border bg-surface hover:border-primary/50 hover:shadow-sm'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="text-xs font-semibold text-primary uppercase tracking-wider">{v.Brand}</span>
                              <h4 className="text-base font-bold text-on-surface mt-0.5">{v.PlateNumber}</h4>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="px-2.5 py-1 bg-gray-100 text-[11px] font-bold text-gray-700 rounded-md">
                                🚌 {v.Seats} chỗ
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                remainingSeats > 0
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-red-50 text-red-700 border border-red-200'
                              }`}>
                                Còn {remainingSeats} chỗ trống
                              </span>
                            </div>
                          </div>
                          
                          <div className="mt-2 pt-2 border-t border-border/60">
                            <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Lịch bận hôm nay:</div>
                            {busySlots.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {busySlots.map((slot, sIdx) => {
                                  const startHour = slot.DepartureTime
                                    ? new Date(slot.DepartureTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                                    : 'N/A';
                                  const endHour = slot.ReturnTime
                                    ? new Date(slot.ReturnTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                                    : 'N/A';
                                  return (
                                    <span key={sIdx} className="px-2 py-0.5 bg-red-50 border border-red-200 text-red-600 rounded text-[10px] font-semibold">
                                      {startHour} - {endHour} ({slot.Status})
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="inline-block px-2.5 py-0.5 bg-green-50 border border-green-200 text-green-600 rounded text-[10px] font-semibold">
                                ✓ Trống lịch
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Driver select combobox for Company Vehicle selection */}
                {selectedVehicleId && (
                  <div className="form-group mt-3 max-w-sm">
                    <label className="text-xs font-semibold text-on-surface-variant">Chọn tài xế lái xe chiều đi</label>
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
                )}
              </div>
            ) : (
              /* Outside vehicle input */
              <div className="form-group">
                <label>Chi tiết xe ngoài chiều đi (Thông tin loại xe, taxi/grab, ghi chú...)</label>
                <input
                  type="text"
                  placeholder="Nhập ghi chú phương tiện bên ngoài..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            )}

            {/* Departure leg notes for coordinate driver if company vehicle chosen */}
            {vehicleType === 'Xe công ty' && (
              <div className="form-group">
                <label>Ghi chú cho bộ phận điều phối chiều đi</label>
                <input
                  type="text"
                  placeholder="Hành lý đặc biệt, yêu cầu riêng..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            )}

            {/* Accompanying participants section */}
            <div className="border-t border-border pt-4 space-y-4">
              <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">👥 Người Tham Gia Đi Cùng Chiều Đi</h4>

              <div className="form-group">
                <label>Tìm kiếm nhân viên để thêm nhanh</label>
                <AutocompleteInput
                  value=""
                  onChange={() => { }}
                  onSelect={handleAttendeeSelect}
                  placeholder="Gõ tên nhân viên..."
                  clearAfterSelect
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label>Danh sách người đi (ngăn cách bởi dấu phẩy)</label>
                  <input
                    type="text"
                    placeholder="Nguyễn Văn A, Trần Thị B..."
                    value={attendees}
                    onChange={e => setAttendees(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Email người đi (ngăn cách bởi dấu chấm phẩy)</label>
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

            {/* Step 2 Actions */}
            <div className="flex justify-end gap-3 border-t border-border pt-4 mt-6">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setCurrentStep(1)}
              >
                Quay lại
              </button>
              <button
                type="button"
                className="btn btn-primary min-w-[150px]"
                disabled={submitting}
                onClick={() => {
                  if (isRoundTrip) {
                    setCurrentStep(3);
                  } else {
                    executeSubmit();
                  }
                }}
              >
                {isRoundTrip ? 'Tiếp tục' : (submitting ? 'Đang gửi...' : (editBookingId ? 'Lưu Thay Đổi' : 'Gửi yêu cầu'))}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: RETURN VEHICLE & PARTICIPANTS (Conditional on isRoundTrip) */}
        {currentStep === 3 && isRoundTrip && (
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-primary border-b border-border pb-2 mb-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">keyboard_return</span>
              THẺ 3: THÔNG TIN CHIỀU VỀ
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Route Return */}
              <div className="flex flex-col gap-4">
                <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">📍 Lộ Trình Chiều Về</h4>
                
                {/* Return Pickup (Read-only, Departure's Destination) */}
                <div className="form-group">
                  <label>Điểm đón chiều về (Read-only)</label>
                  <input
                    type="text"
                    value={returnPickupLocation}
                    readOnly
                    className="bg-gray-50 text-gray-500 font-medium cursor-not-allowed"
                  />
                </div>

                {/* Return Stops */}
                <div className="form-group">
                  <div className="flex justify-between items-center mb-1">
                    <label className="mb-0">Các điểm dừng dọc đường chiều về</label>
                    <button
                      type="button"
                      onClick={handleAddReturnStop}
                      className="text-xs text-primary font-semibold flex items-center gap-0.5 hover:underline"
                    >
                      <span className="material-symbols-outlined text-[14px]">add_circle</span>
                      Thêm điểm dừng
                    </button>
                  </div>

                  {returnStops.map((stop, idx) => (
                    <div key={idx} className="flex gap-2 mb-2 items-center" ref={el => returnStopsRefs.current[idx] = el}>
                      <span className="text-xs text-on-surface-variant font-semibold min-w-[50px]">Điểm {idx + 1}:</span>
                      <div className="flex-1 flex gap-2 items-center">
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            placeholder={`Địa chỉ điểm dừng ${idx + 1}`}
                            value={stop}
                            onChange={e => handleReturnStopChange(idx, e.target.value)}
                            onFocus={() => handleReturnStopFocus(idx)}
                            autoComplete="off"
                          />
                          {returnStopsShowDropdown[idx] && returnStopsSuggestions[idx]?.length > 0 && (
                            <div className="autocomplete-dropdown">
                              {returnStopsSuggestions[idx].map((item, keyIdx) => (
                                <div
                                  key={keyIdx}
                                  className="autocomplete-item"
                                  onMouseDown={() => handleSelectReturnStop(idx, item)}
                                >
                                  <span className="autocomplete-name">{item.label}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => openMapPicker('returnStop_' + idx)}
                          className="btn btn-ghost p-2"
                          title="Chọn từ bản đồ"
                          style={{ height: '38px', width: '38px', minWidth: '38px', borderRadius: '8px' }}
                        >
                          <span className="material-symbols-outlined text-[18px]">map</span>
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveReturnStop(idx)}
                        className="text-danger p-1 hover:bg-red-50 rounded"
                        title="Xóa điểm dừng"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Return Destination (Editable, pre-populated with Departure's Pickup) */}
                <div className="form-group" ref={returnDestRef}>
                  <label>Điểm đến chiều về <span className="text-danger">*</span></label>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="Nhập địa chỉ đến chiều về..."
                        value={returnDestination}
                        onChange={handleReturnDestChange}
                        onFocus={handleReturnDestFocus}
                        autoComplete="off"
                        required
                      />
                      {returnDestShowDropdown && returnDestSuggestions.length > 0 && (
                        <div className="autocomplete-dropdown">
                          {returnDestSuggestions.map((item, idx) => (
                            <div
                              key={idx}
                              className="autocomplete-item"
                              onMouseDown={() => handleSelectReturnDest(item)}
                            >
                              <span className="autocomplete-name">{item.label}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => openMapPicker('returnDestination')}
                      className="btn btn-ghost p-2"
                      title="Chọn từ bản đồ"
                      style={{ height: '38px', width: '38px', minWidth: '38px', borderRadius: '8px' }}
                    >
                      <span className="material-symbols-outlined text-[18px]">map</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Return Time & Vehicles */}
              <div className="flex flex-col gap-4">
                <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">📅 Thời Gian & Phương Tiện Chiều Về</h4>

                <div className="form-group">
                  <label>Thời gian về (dự kiến, Read-only)</label>
                  <input
                    type="datetime-local"
                    value={returnTime}
                    readOnly
                    className="bg-gray-50 text-gray-500 font-medium cursor-not-allowed"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="form-group">
                    <label>Phương tiện về</label>
                    <select value={returnVehicleType} onChange={e => setReturnVehicleType(e.target.value)}>
                      {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Hành khách về <span className="text-danger">*</span></label>
                    <input
                      type="number"
                      min="1"
                      value={returnPassengerCount}
                      onChange={e => setReturnPassengerCount(parseInt(e.target.value) || 1)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Độ ưu tiên về</label>
                    <select value={returnPriority} onChange={e => setReturnPriority(e.target.value)}>
                      <option value="Bình thường">Bình thường</option>
                      <option value="Khẩn">⚠️ Khẩn cấp</option>
                      <option value="VIP">🌟 VIP</option>
                    </select>
                  </div>
                </div>

                {/* Return Vehicle Selection Cards if Company Car */}
                {returnVehicleType === 'Xe công ty' ? (
                  <div className="space-y-3">
                    <label className="font-semibold text-xs text-on-surface-variant block">🚗 CHỌN XE CÔNG TY CHIỀU VỀ</label>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {vehiclesList.map(v => {
                        const isSelected = returnVehicleId === v.Id;
                        const busySlots = getVehicleSlotsForDate(v.Id, returnTime);
                        const approvedSlots = busySlots.filter(s => s.Status === 'Team Admin đã duyệt');
                        const bookedPassengers = approvedSlots.reduce((sum, s) => sum + (Number(s.PassengerCount) || 0), 0);
                        const totalSeats = Number(v.Seats) || 0;
                        const remainingSeats = Math.max(0, totalSeats - bookedPassengers);
                        
                        return (
                          <div
                            key={v.Id}
                            onClick={() => setReturnVehicleId(isSelected ? '' : v.Id)}
                            className={`cursor-pointer p-4 rounded-xl border transition-all duration-300 flex flex-col justify-between ${
                              isSelected
                                ? 'border-primary bg-primary/5 shadow-md scale-[1.01]'
                                : 'border-border bg-surface hover:border-primary/50 hover:shadow-sm'
                            }`}
                          >
                            <div>
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">{v.Brand}</span>
                                  <h4 className="text-base font-bold text-on-surface mt-0.5">{v.PlateNumber}</h4>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <span className="px-2.5 py-1 bg-gray-100 text-[11px] font-bold text-gray-700 rounded-md">
                                    🚌 {v.Seats} chỗ
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    remainingSeats > 0
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-red-50 text-red-700 border border-red-200'
                                  }`}>
                                    Còn {remainingSeats} chỗ trống
                                  </span>
                                </div>
                              </div>
                              
                              <div className="mt-2 pt-2 border-t border-border/60">
                                <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Lịch bận ngày về:</div>
                                {busySlots.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {busySlots.map((slot, sIdx) => {
                                      const startHour = slot.DepartureTime
                                        ? new Date(slot.DepartureTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                                        : 'N/A';
                                      const endHour = slot.ReturnTime
                                        ? new Date(slot.ReturnTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                                        : 'N/A';
                                      return (
                                        <span key={sIdx} className="px-2 py-0.5 bg-red-50 border border-red-200 text-red-600 rounded text-[10px] font-semibold">
                                          {startHour} - {endHour} ({slot.Status})
                                        </span>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className="inline-block px-2.5 py-0.5 bg-green-50 border border-green-200 text-green-600 rounded text-[10px] font-semibold">
                                    ✓ Trống lịch
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {returnVehicleId && (
                      <div className="form-group mt-3 max-w-sm">
                        <label className="text-xs font-semibold text-on-surface-variant">Chọn tài xế lái xe chiều về</label>
                        <select
                          value={returnDriverId}
                          onChange={e => setReturnDriverId(e.target.value)}
                        >
                          <option value="">-- Tự lái / Để trống --</option>
                          {driversList.map(d => (
                            <option key={d.Id} value={d.Id}>{d.FullName} ({d.Phone || '—'})</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Chi tiết xe ngoài chiều về</label>
                    <input
                      type="text"
                      placeholder="Nhập ghi chú phương tiện bên ngoài..."
                      value={returnNotes}
                      onChange={e => setReturnNotes(e.target.value)}
                    />
                  </div>
                )}

                {returnVehicleType === 'Xe công ty' && (
                  <div className="form-group">
                    <label>Ghi chú chiều về</label>
                    <input
                      type="text"
                      placeholder="Ghi chú cho bộ phận điều phối..."
                      value={returnNotes}
                      onChange={e => setReturnNotes(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Return Attendees */}
            <div className="border-t border-border pt-4 space-y-4">
              <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">👥 Người Tham Gia Đi Cùng Chiều Về</h4>

              <div className="form-group">
                <label>Tìm kiếm nhân viên để thêm nhanh</label>
                <AutocompleteInput
                  value=""
                  onChange={() => { }}
                  onSelect={handleReturnAttendeeSelect}
                  placeholder="Gõ tên nhân viên..."
                  clearAfterSelect
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label>Danh sách người đi chiều về (ngăn cách bởi dấu phẩy)</label>
                  <input
                    type="text"
                    placeholder="Nguyễn Văn A, Trần Thị B..."
                    value={returnAttendees}
                    onChange={e => setReturnAttendees(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Email người đi chiều về (ngăn cách bởi dấu chấm phẩy)</label>
                  <input
                    type="text"
                    placeholder="a@vietsun.com; b@vietsun.com..."
                    value={returnAttendeesEmail}
                    onChange={e => {
                      const newVal = autoSemicolon(e.target.value, returnAttendeesEmail);
                      setReturnAttendeesEmail(newVal);
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Step 3 Actions */}
            <div className="flex justify-end gap-3 border-t border-border pt-4 mt-6">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setCurrentStep(2)}
              >
                Quay lại
              </button>
              <button
                type="button"
                className="btn btn-primary min-w-[150px]"
                disabled={submitting}
                onClick={executeSubmit}
              >
                {submitting ? 'Đang gửi...' : (editBookingId ? 'Lưu Thay Đổi' : 'Gửi yêu cầu')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- LEAFLET MAP MODAL POPUP --- */}
      {mapModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMapModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden z-10 flex flex-col">
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

            <div className="p-4 flex flex-col gap-3">
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

              <div
                id="leaflet-map"
                className="w-full rounded-xl border border-border bg-gray-50 relative"
                style={{ height: '350px', zIndex: 1 }}
              >
                {!leafletLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                    <span className="material-symbols-outlined animate-spin text-[24px] mr-2">refresh</span>
                    Đang tải bản đồ...
                  </div>
                )}
              </div>

              <div className="p-3 bg-gray-50 border border-border rounded-lg text-xs font-medium min-h-[46px] flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">location_on</span>
                <span className="text-on-surface">{tempAddress || 'Chưa chọn vị trí. Vui lòng bấm lên bản đồ để cắm mốc tọa độ.'}</span>
              </div>
            </div>

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