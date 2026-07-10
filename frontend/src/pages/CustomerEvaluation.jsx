import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';

export default function CustomerEvaluation() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [criteria, setCriteria] = useState([]);
  const [reviewerName, setReviewerName] = useState('');
  const [ratings, setRatings] = useState({}); // { [criteriaId]: { rating, comment } }
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const apiBaseUrl = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    if (!projectId) return;

    setLoading(true);
    // Fetch project info and active criteria
    Promise.all([
      axios.get(`${apiBaseUrl}/submissions/${projectId}`).then(res => res.data.data),
      axios.get(`${apiBaseUrl}/review-criteria?onlyActive=true`).then(res => res.data.data)
    ])
      .then(([projRes, critRes]) => {
        setProject(projRes.project);
        setCriteria(critRes || []);
        
        // Initialize ratings state
        const initialRatings = {};
        critRes.forEach(c => {
          initialRatings[c.Id] = {
            rating: 5, // default 5 stars
            comment: ''
          };
        });
        setRatings(initialRatings);
      })
      .catch(err => {
        console.error('Error loading evaluation page:', err);
        toast.error('Không thể tải biểu mẫu đánh giá. Vui lòng kiểm tra lại đường dẫn.');
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleRatingChange = (criteriaId, value) => {
    setRatings(prev => ({
      ...prev,
      [criteriaId]: {
        ...prev[criteriaId],
        rating: value
      }
    }));
  };

  const handleCommentChange = (criteriaId, value) => {
    setRatings(prev => ({
      ...prev,
      [criteriaId]: {
        ...prev[criteriaId],
        comment: value
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Prepare reviews array
    const reviews = Object.keys(ratings).map(id => ({
      criteriaId: parseInt(id),
      rating: ratings[id].rating,
      comment: ratings[id].comment
    }));

    if (reviews.length === 0) {
      toast.error('Không tìm thấy tiêu chí đánh giá nào để gửi.');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${apiBaseUrl}/review-criteria/submit`, {
        projectId,
        reviewerName: reviewerName.trim() || 'Khách hàng',
        reviews
      });
      setSubmitted(true);
      toast.success('Gửi đánh giá thành công!');
    } catch (err) {
      console.error('Error submitting feedback:', err);
      toast.error(err.response?.data?.error || 'Không thể gửi đánh giá, vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-600 font-bold">Đang tải biểu mẫu khảo sát...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <span className="material-symbols-outlined text-red-500 text-6xl mb-4">error</span>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Đường dẫn không hợp lệ</h2>
        <p className="text-slate-500 max-w-md">Không tìm thấy thông tin đơn tiếp đón hoặc biểu mẫu khảo sát này đã đóng.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-slate-100 text-center space-y-6">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-500 animate-bounce">
            <span className="material-symbols-outlined text-4xl font-bold">check_circle</span>
          </div>
          <h2 className="text-2xl font-black text-slate-800">Cảm ơn Quý khách!</h2>
          <p className="text-slate-600 text-sm leading-relaxed">
            Ý kiến đóng góp quý báu của Quý khách đã được gửi về hệ thống của chúng tôi để không ngừng hoàn thiện và nâng cao chất lượng dịch vụ đón tiếp.
          </p>
          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 font-semibold">CSR CRM &copy; {new Date().getFullYear()}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 flex justify-center">
      <Toaster position="top-right" />
      <div className="max-w-2xl w-full space-y-8">
        
        {/* Header Branding */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-1">
            <span className="material-symbols-outlined text-2xl font-bold font-icon">rate_review</span>
          </div>
          <h1 className="text-xl font-black text-slate-800 uppercase tracking-wide">
            ĐÁNH GIÁ CHẤT LƯỢNG ĐÓN TIẾP KHÁCH HÀNG
          </h1>
          <p className="text-xs text-slate-400 font-bold">Mã số tiếp đón: #{project.Project_id}</p>
          
          <div className="w-full grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-left text-xs bg-slate-50/50 p-4 rounded-2xl mt-4">
            <div>
              <span className="text-slate-400 font-bold block mb-0.5">Khách hàng / Đối tác</span>
              <span className="text-slate-800 font-black">{project.CustomerName}</span>
            </div>
            <div>
              <span className="text-slate-400 font-bold block mb-0.5">Chủ đề làm việc</span>
              <span className="text-slate-800 font-bold block truncate">{project.MeetingTopic || '—'}</span>
            </div>
          </div>
        </div>

        {/* Survey Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Reviewer Identity */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-600 text-lg">person</span>
              Thông tin Người Đánh Giá (Tùy chọn)
            </h3>
            <div>
              <input
                type="text"
                value={reviewerName}
                onChange={e => setReviewerName(e.target.value)}
                placeholder="Nhập tên hoặc chức vụ của Quý khách..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all"
              />
            </div>
          </div>

          {/* Criteria Cards */}
          <div className="space-y-4">
            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2 px-2">
              <span className="material-symbols-outlined text-indigo-600 text-lg font-icon">checklist</span>
              Các Tiêu Chí Khảo Sát
            </h3>

            {criteria.map((item, index) => {
              const currentVal = ratings[item.Id]?.rating || 5;
              const currentComment = ratings[item.Id]?.comment || '';

              return (
                <div key={item.Id} className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <span className="text-[10px] uppercase font-black tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md mb-2 inline-block">
                        Tiêu chí {index + 1}: {item.CriteriaGroup}
                      </span>
                      <h4 className="font-extrabold text-slate-800 text-sm md:text-base leading-snug">
                        {item.CriteriaName}
                      </h4>
                      {item.Description && (
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.Description}</p>
                      )}
                    </div>
                  </div>

                  {/* Star Rating Interactive */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => handleRatingChange(item.Id, star)}
                          className="focus:outline-none transition-transform hover:scale-125"
                        >
                          <span className={`material-symbols-outlined text-3xl select-none font-icon ${
                            star <= currentVal ? 'text-amber-400 fill-amber-400 font-bold' : 'text-slate-200'
                          }`}>
                            star
                          </span>
                        </button>
                      ))}
                      <span className="text-xs font-bold text-slate-600 ml-2 bg-slate-100 px-2.5 py-0.5 rounded-full">
                        {currentVal} / 5
                      </span>
                    </div>
                  </div>

                  {/* Optional Comment for each Criteria */}
                  <div className="space-y-1">
                    <textarea
                      value={currentComment}
                      onChange={e => handleCommentChange(item.Id, e.target.value)}
                      placeholder="Ý kiến đóng góp cụ thể về tiêu chí này (nếu có)..."
                      rows={2}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs transition-all placeholder-slate-400 bg-slate-50/50"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full btn btn-primary py-4 rounded-3xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 hover:shadow-xl font-bold transition-all text-sm uppercase tracking-wide"
          >
            {submitting ? (
              <>
                <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                Đang gửi khảo sát...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">send</span>
                Gửi Đánh Giá Khảo Sát
              </>
            )}
          </button>
          
        </form>
      </div>
    </div>
  );
}
