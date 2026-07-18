import React, { useState } from 'react';
import '../index.css';
import { API_BASE_URL } from '../config';

const YellowPagesDashboard = () => {
  const [keyword, setKeyword] = useState('');
  const [country, setCountry] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle'); // idle, running, success, error

  const handleStartScraping = async () => {
    if (isScraping || !keyword.trim()) return;

    setIsScraping(true);
    setStatus('running');
    setResults([]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/scrape/directories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, country })
      });
      
      const data = await response.json();

      if (data.success) {
        setResults(data.data);
        setStatus('success');
      } else {
        setStatus('error');
        alert('حدث خطأ أثناء السحب: ' + data.error);
      }
    } catch (error) {
      console.error(error);
      setStatus('error');
      alert('تعذر الاتصال بالخادم.');
    } finally {
      setTimeout(() => {
        setIsScraping(false);
        if(status !== 'error') setStatus('idle');
      }, 1000);
    }
  };

  return (
    <div style={{ padding: '20px', width: '100%', height: '100%', overflowY: 'auto' }}>
      <div className="glass-panel" style={{ padding: '30px', marginBottom: '20px' }}>
        <h2 style={{ marginBottom: '20px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="glow-icon">📒</span> أدلة الأعمال (الصفحات الصفراء)
        </h2>
        
        <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>
          أدخل الكلمات المفتاحية واختر البلد للبحث وسحب بيانات الشركات والمؤسسات من الأدلة.
        </p>

        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <div style={{ flex: 1, minWidth: '250px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>الكلمات المفتاحية (مثال: مستشفيات، مطاعم)</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="ابحث هنا..." 
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{
                width: '100%', padding: '14px', borderRadius: '12px',
                background: 'rgba(15, 17, 26, 0.5)', border: '1px solid var(--border-glass)',
                color: 'var(--text-main)', fontSize: '15px'
              }}
            />
          </div>

          <div style={{ flex: 1, minWidth: '250px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>البلد</label>
            <input 
              type="text"
              className="input-field" 
              placeholder="اكتب اسم البلد هنا (مثال: مصر، السعودية، USA)"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              style={{
                width: '100%', padding: '14px', borderRadius: '12px',
                background: 'rgba(15, 17, 26, 0.5)', border: '1px solid var(--border-glass)',
                color: 'var(--text-main)', fontSize: '15px'
              }}
            />
          </div>
        </div>

        <button 
          onClick={handleStartScraping}
          disabled={isScraping || !keyword.trim()}
          style={{
            background: isScraping ? 'var(--text-muted)' : 'var(--primary)',
            color: '#fff', border: 'none', padding: '15px 30px',
            borderRadius: '12px', fontSize: '16px', fontWeight: 'bold',
            cursor: isScraping || !keyword.trim() ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease', boxShadow: isScraping ? 'none' : '0 4px 15px var(--primary-glow)',
            display: 'flex', alignItems: 'center', gap: '10px'
          }}
        >
          {isScraping ? (
            <>
              <span className="spinner" style={{ width: '20px', height: '20px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
              جاري السحب...
            </>
          ) : (
            <><span>🔍</span> ابدأ السحب</>
          )}
        </button>
      </div>

      {results.length > 0 && (
        <div className="glass-panel" style={{ padding: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ color: 'var(--secondary)' }}>النتائج ({results.length})</h3>
            <button 
              style={{
                background: 'rgba(45, 212, 191, 0.1)', color: 'var(--secondary)',
                border: '1px solid var(--secondary)', padding: '8px 16px', borderRadius: '8px',
                cursor: 'pointer', transition: 'all 0.3s ease'
              }}
              onClick={() => {
                // Mock export functionality
                alert('تم التصدير بنجاح (Simulation)');
              }}
            >
              تصدير CSV
            </button>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                  <th style={{ padding: '15px', color: 'var(--text-muted)' }}>الاسم</th>
                  <th style={{ padding: '15px', color: 'var(--text-muted)' }}>الهاتف</th>
                  <th style={{ padding: '15px', color: 'var(--text-muted)' }}>العنوان</th>
                  <th style={{ padding: '15px', color: 'var(--text-muted)' }}>الموقع الإلكتروني</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.3s' }}>
                    <td style={{ padding: '15px', color: 'var(--text-main)', fontWeight: 'bold' }}>{item.name}</td>
                    <td style={{ padding: '15px', color: 'var(--secondary)' }}>{item.phone}</td>
                    <td style={{ padding: '15px', color: 'var(--text-muted)' }}>{item.address}</td>
                    <td style={{ padding: '15px' }}>
                      {item.website && item.website !== 'N/A' ? (
                        <a href={item.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>زيارة الموقع</a>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>غير متوفر</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        tbody tr:hover {
          background: rgba(255, 255, 255, 0.02);
        }
      `}</style>
    </div>
  );
};

export default YellowPagesDashboard;
