import React, { useState } from 'react';
import './index.css';
import EmailsPage from './components/EmailsPage';
import TelegramDashboard from './components/TelegramDashboard';
import YellowPagesDashboard from './components/YellowPagesDashboard';
import { API_BASE_URL } from './config';

const fetch = async (url, options) => {
  const finalUrl = typeof url === 'string' && url.startsWith('http://localhost:3000')
    ? url.replace('http://localhost:3000', API_BASE_URL)
    : url;
  return window.fetch(finalUrl, options);
};

function App() {
  const [isScraping, setIsScraping] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, running, success
  const [results, setResults] = useState([]);

  const [activeTab, setActiveTab] = useState('new'); // new, history, analytics, telegram, settings
  const [url, setUrl] = useState('');
  
  const [extractEmails, setExtractEmails] = useState(true);
  const [extractPhones, setExtractPhones] = useState(false);
  const [extractSocials, setExtractSocials] = useState(false);
  
  // Google Maps State
  const [mapQuery, setMapQuery] = useState('');
  const [mapLocation, setMapLocation] = useState('');
  const [mapReviews, setMapReviews] = useState(true);
  const [mapPhones, setMapPhones] = useState(true);
  const [mapWebsites, setMapWebsites] = useState(true);
  const [mapAddress, setMapAddress] = useState(true);
  const [sessionName, setSessionName] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [isDeepScraping, setIsDeepScraping] = useState(false);
  
  const [showReport, setShowReport] = useState(false);
  const [reportData, setReportData] = useState(null);
  
  const [selectedSession, setSelectedSession] = useState(null);
  
  // Single item scraping state
  const [scrapingItemId, setScrapingItemId] = useState(null);
  const [isBulkScraping, setIsBulkScraping] = useState(false);

  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('scrapingHistory') || '[]'));

  const [smtpSettings, setSmtpSettings] = useState(() => JSON.parse(localStorage.getItem('smtpSettings') || '{"host":"", "port":"465", "user":"", "pass":""}'));
  
  const handleSaveSmtp = (e) => {
    e.preventDefault();
    localStorage.setItem('smtpSettings', JSON.stringify(smtpSettings));
    alert('تم حفظ إعدادات الـ SMTP بنجاح!');
  };

  const handleStartScraping = async () => {
    if (isScraping || !url.trim()) return;
    
    setIsScraping(true);
    setStatus('running');
    setResults([]);

    const urls = url.split('\n').map(u => u.trim()).filter(u => u);
    let allResults = [];

    try {
      let currentId = 1;
      
      for (let i = 0; i < urls.length; i++) {
        const targetUrl = urls[i];
        try {
          const response = await fetch('http://localhost:3000/api/scrape/web', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: targetUrl, extractEmails, extractPhones, extractSocials })
          });
          const data = await response.json();

          if (data.success) {
            data.data.forEach((item) => {
              const resItem = { ...item, id: currentId++, url: targetUrl };
              setResults(prev => [...prev, resItem]);
              allResults.push(resItem);
            });
          } else {
            setResults(prev => [...prev, { id: currentId++, field: 'خطأ', value: data.error, confidence: '0%', url: targetUrl }]);
          }
        } catch (err) {
          setResults(prev => [...prev, { id: currentId++, field: 'فشل الاتصال', value: 'تعذر الوصول للخادم', confidence: '0%', url: targetUrl }]);
        }
      }
      
      setStatus('success');
      
      const newSession = {
        id: Date.now(),
        type: 'web',
        sessionName: sessionName || '',
        query: urls[0],
        date: new Date().toLocaleString('en-US', {hour12: true}),
        data: allResults
      };
      const updatedHistory = [newSession, ...history];
      setHistory(updatedHistory);
      localStorage.setItem('scrapingHistory', JSON.stringify(updatedHistory));

      setTimeout(() => { setIsScraping(false); setStatus('idle'); }, 3000);
      
    } catch (error) {
      console.error(error);
      setStatus('error');
      setIsScraping(false);
      alert('حدث خطأ غير متوقع.');
    }
  };

  const handleStartMapsScraping = async () => {
    if (isScraping || !mapQuery.trim() || !mapLocation.trim()) return;
    
    setIsScraping(true);
    setStatus('running');
    setResults([]);

    const queries = mapQuery.split('\n').map(q => q.trim()).filter(q => q);
    let allResults = [];
    let currentId = 1;

    try {
      for (const query of queries) {
        const response = await fetch('http://localhost:3000/api/scrape/maps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: query, location: mapLocation, mapReviews, mapPhones, mapWebsites, mapAddress })
        });
        const data = await response.json();

        if (data.success) {
          const validData = data.data.filter(item => item.title !== 'لم يتم العثور على نتائج في هذه المنطقة');
          validData.forEach((item) => {
            // Duplicate Prevention: Check if this item already exists in allResults
            const isDuplicate = allResults.some(existing => 
              (existing.url && item.url && existing.url !== '-' && existing.url === item.url) || 
              (existing.title === item.title && existing.phone === item.phone && existing.title !== 'None') ||
              (existing.phone && item.phone && existing.phone !== 'None' && existing.phone === item.phone)
            );

            if (!isDuplicate) {
              item.id = currentId++; // Re-assign IDs to be sequential
              allResults.push(item);
            }
          });
          // Update UI progressively
          setResults([...allResults]);
        } else {
          throw new Error(data.error);
        }
      }

      setStatus('success');
      
      // Save session with data
      const newSession = {
        id: Date.now(),
        type: 'maps',
        sessionName: sessionName || '',
        query: queries.join('، '),
        location: mapLocation,
        date: new Date().toLocaleString('en-US', {hour12: true}),
        resultsCount: allResults.length,
        data: allResults
      };
      const updatedHistory = [newSession, ...history];
      setHistory(updatedHistory);
      localStorage.setItem('scrapingHistory', JSON.stringify(updatedHistory));
      
      setTimeout(() => { setIsScraping(false); setStatus('idle'); }, 3000);

    } catch (error) {
      console.error(error);
      setStatus('error');
      setIsScraping(false);
      alert(error.message || 'فشل الاتصال بالخادم. تأكد من تشغيل الباك اند.');
    }
  };

  const handleDeepScrape = async () => {
    if (results.length === 0 || isDeepScraping) return;
    setIsDeepScraping(true);
    setStatus('running');
    
    let updatedResults = [...results];
    
    for (let i = 0; i < updatedResults.length; i++) {
      const item = updatedResults[i];
      if (item.website && item.website !== 'N/A' && item.website !== 'غير متوفر' && item.website !== 'None') {
        try {
          const response = await fetch('http://localhost:3000/api/scrape/web', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: item.website, extractEmails: true, extractPhones: true, extractSocials: true })
          });
          const data = await response.json();
          if (data.success) {
            const emailRow = data.data.find(d => d.field === 'البريد الإلكتروني');
            if (emailRow && emailRow.value !== 'لم يتم العثور') item.email = emailRow.value;
            
            const phoneRow = data.data.find(d => d.field === 'أرقام الهواتف');
            if (phoneRow && phoneRow.value !== 'لم يتم العثور' && phoneRow.value !== 'None') {
              item.extraPhone = phoneRow.value;
            }

            const whatsappRow = data.data.find(d => d.field === 'رقم الواتساب');
            if (whatsappRow && whatsappRow.value !== 'لم يتم العثور' && whatsappRow.value !== 'None') {
              item.whatsapp = whatsappRow.value;
            }

            const socialsRow = data.data.find(d => d.field === 'السوشيال ميديا');
            if (socialsRow && socialsRow.value !== 'لم يتم العثور' && socialsRow.value !== 'None') {
              item.socials = socialsRow.value;
            }
          }
          setResults([...updatedResults]);
        } catch (e) {
          console.error("Failed deep scrape for", item.website);
        }
      }
    }
    
    // Update history with new data
    if (history.length > 0) {
      const newHistory = [...history];
      newHistory[0].data = updatedResults;
      setHistory(newHistory);
      localStorage.setItem('scrapingHistory', JSON.stringify(newHistory));
    }
    
    setIsDeepScraping(false);
    setStatus('success');
    
    // Calculate Report Data
    const total = updatedResults.length;
    const withEmail = updatedResults.filter(r => r.email && r.email !== 'None').length;
    const withPhone = updatedResults.filter(r => r.extraPhone && r.extraPhone !== 'None').length;
    const withWhatsapp = updatedResults.filter(r => r.whatsapp && r.whatsapp !== 'None').length;
    const withSocials = updatedResults.filter(r => r.socials && r.socials !== 'None').length;

    setReportData({
      total,
      withEmail,
      withPhone,
      withWhatsapp,
      withSocials
    });
    setShowReport(true);
  };

  const handleCleanData = () => {
    if (results.length === 0) return;
    
    let cleaned = [];
    let duplicatesRemoved = 0;
    let uselessRemoved = 0;
    
    results.forEach(item => {
      // 1. Check for duplicates
      const isDuplicate = cleaned.some(existing => 
        (existing.url && item.url && existing.url !== '-' && existing.url === item.url) || 
        (existing.title === item.title && existing.phone === item.phone && existing.title !== 'None') ||
        (existing.phone && item.phone && existing.phone !== 'None' && existing.phone === item.phone)
      );
      
      if (isDuplicate) {
        duplicatesRemoved++;
        return;
      }
      
      // 2. Check for "useless" data (no phone, no website, no email, no socials)
      const hasPhone = item.phone && item.phone !== 'None';
      const hasExtraPhone = item.extraPhone && item.extraPhone !== 'None';
      const hasWhatsapp = item.whatsapp && item.whatsapp !== 'None';
      const hasWebsite = item.website && item.website !== 'None' && item.website !== 'N/A' && item.website !== 'غير متوفر';
      const hasEmail = item.email && item.email !== 'None';
      const hasSocials = item.socials && item.socials !== 'None';
      
      if (!hasPhone && !hasExtraPhone && !hasWhatsapp && !hasWebsite && !hasEmail && !hasSocials) {
        uselessRemoved++;
        return;
      }
      
      cleaned.push(item);
    });
    
    // Re-assign IDs
    cleaned.forEach((item, index) => item.id = index + 1);
    
    setResults(cleaned);
    
    // Update history
    if (history.length > 0) {
      const newHistory = [...history];
      newHistory[0].data = cleaned;
      newHistory[0].resultsCount = cleaned.length;
      setHistory(newHistory);
      localStorage.setItem('scrapingHistory', JSON.stringify(newHistory));
    }
    
    alert(`تم تنظيف البيانات بنجاح! 🧹\n\n- تم حذف (${duplicatesRemoved}) نتيجة مكررة.\n- تم حذف (${uselessRemoved}) نتيجة فارغة بدون أي وسائل تواصل.`);
  };

  const handleBulkScrape = async (type) => {
    if (!selectedSession || !selectedSession.data || selectedSession.data.length === 0) return;
    
    setIsBulkScraping(true);
    let updatedData = [...selectedSession.data];
    
    // Determine what to extract based on button clicked
    const extractEmails = type === 'all' || type === 'emails';
    const extractPhones = type === 'all' || type === 'phones';
    const extractSocials = type === 'all' || type === 'whatsapp'; // whatsapp is included in socials extraction
    
    for (let i = 0; i < updatedData.length; i++) {
      const item = updatedData[i];
      if (item && item.website && item.website !== 'N/A' && item.website !== 'غير متوفر' && item.website !== 'None') {
        setScrapingItemId(i); // Update UI indicator for current item
        try {
          const response = await fetch('http://localhost:3000/api/scrape/web', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: item.website, extractEmails, extractPhones, extractSocials })
          });
          const data = await response.json();
          
          if (data.success) {
            if (extractEmails) {
              const emailRow = data.data.find(d => d.field === 'البريد الإلكتروني');
              if (emailRow && emailRow.value !== 'لم يتم العثور') updatedData[i].email = emailRow.value;
            }
            if (extractPhones) {
              const phoneRow = data.data.find(d => d.field === 'أرقام الهواتف');
              if (phoneRow && phoneRow.value !== 'لم يتم العثور' && phoneRow.value !== 'None') {
                updatedData[i].extraPhone = phoneRow.value;
              }
            }
            if (extractSocials) {
              const whatsappRow = data.data.find(d => d.field === 'رقم الواتساب');
              if (whatsappRow && whatsappRow.value !== 'لم يتم العثور' && whatsappRow.value !== 'None') {
                updatedData[i].whatsapp = whatsappRow.value;
              }
              const socialsRow = data.data.find(d => d.field === 'السوشيال ميديا');
              if (socialsRow && socialsRow.value !== 'لم يتم العثور' && socialsRow.value !== 'None') {
                updatedData[i].socials = socialsRow.value;
              }
            }
          }
        } catch (e) {
          console.error("Failed deep scrape for", item.website);
        }
      }
    }
    
    // Finalize update
    setSelectedSession({ ...selectedSession, data: updatedData });
    const newHistory = history.map(h => {
      if (h.date === selectedSession.date && h.sessionName === selectedSession.sessionName) {
        return { ...h, data: updatedData };
      }
      return h;
    });
    setHistory(newHistory);
    localStorage.setItem('scrapingHistory', JSON.stringify(newHistory));
    
    setScrapingItemId(null);
    setIsBulkScraping(false);
    alert('تم تحديث البيانات المحددة بنجاح!');
  };

  const handleDeepScrapeSingle = async (item, index) => {
    if (!item.website || item.website === 'N/A' || item.website === 'غير متوفر' || item.website === 'None') {
      alert('لا يوجد موقع إلكتروني لهذه المنشأة لاستخراج البيانات منه.');
      return;
    }
    
    setScrapingItemId(index);
    try {
      const response = await fetch('http://localhost:3000/api/scrape/web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: item.website, extractEmails: true, extractPhones: true, extractSocials: true })
      });
      const data = await response.json();
      
      if (data.success) {
        let updatedItem = { ...item };
        
        const emailRow = data.data.find(d => d.field === 'البريد الإلكتروني');
        if (emailRow && emailRow.value !== 'لم يتم العثور') updatedItem.email = emailRow.value;
        
        const phoneRow = data.data.find(d => d.field === 'أرقام الهواتف');
        if (phoneRow && phoneRow.value !== 'لم يتم العثور' && phoneRow.value !== 'None') {
          updatedItem.extraPhone = phoneRow.value;
        }

        const whatsappRow = data.data.find(d => d.field === 'رقم الواتساب');
        if (whatsappRow && whatsappRow.value !== 'لم يتم العثور' && whatsappRow.value !== 'None') {
          updatedItem.whatsapp = whatsappRow.value;
        }

        const socialsRow = data.data.find(d => d.field === 'السوشيال ميديا');
        if (socialsRow && socialsRow.value !== 'لم يتم العثور' && socialsRow.value !== 'None') {
          updatedItem.socials = socialsRow.value;
        }
        
        // Update selectedSession
        const newData = [...selectedSession.data];
        newData[index] = updatedItem;
        setSelectedSession({ ...selectedSession, data: newData });
        
        // Update history
        const newHistory = history.map(h => {
          if (h.date === selectedSession.date && h.sessionName === selectedSession.sessionName) {
            return { ...h, data: newData };
          }
          return h;
        });
        setHistory(newHistory);
        localStorage.setItem('scrapingHistory', JSON.stringify(newHistory));
      } else {
        alert('لم يتم العثور على بيانات إضافية أو تعذر الوصول للموقع.');
      }
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء محاولة جلب البيانات.');
    }
    setScrapingItemId(null);
  };

  const handleExportCSV = (sessionData = null, sessionType = null, exportFilter = 'all') => {
    const dataToExport = Array.isArray(sessionData) ? sessionData : results;
    const type = typeof sessionType === 'string' ? sessionType : activeTab;

    if (dataToExport.length === 0) {
      alert('لا توجد بيانات لتصديرها');
      return;
    }
    
    let csvRows = [];
    
    if (type === 'web' || !type) {
      // Group results by URL
      const groupedData = {};
      const allFields = new Set();
      
      dataToExport.forEach(row => {
        if (!groupedData[row.url]) {
          groupedData[row.url] = { 'الرابط': row.url };
        }
        groupedData[row.url][row.field] = row.value;
        allFields.add(row.field);
      });
      
      // Create CSV content
      const headers = ['الرابط', ...Array.from(allFields)];
      csvRows.push(headers.map(h => `"${h}"`).join(','));
      
      Object.values(groupedData).forEach(dataRow => {
        const values = headers.map(header => {
          const val = dataRow[header] || '';
          return `"${String(val).replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(','));
      });
    } else if (type === 'maps') {
      let headers = ['اسم المكان', 'التقييم', 'عدد المراجعات', 'رقم الهاتف', 'رقم إضافي', 'واتساب', 'السوشيال ميديا', 'الموقع الإلكتروني', 'العنوان', 'البريد الإلكتروني', 'رابط جوجل ماب'];
      
      if (exportFilter === 'emails') {
        headers = ['اسم المكان', 'البريد الإلكتروني', 'الموقع الإلكتروني'];
      } else if (exportFilter === 'whatsapp') {
        headers = ['اسم المكان', 'واتساب', 'الموقع الإلكتروني'];
      } else if (exportFilter === 'phones') {
        headers = ['اسم المكان', 'رقم الهاتف', 'رقم إضافي'];
      }
      
      csvRows.push(headers.map(h => `"${h}"`).join(','));
      
      dataToExport.forEach(item => {
        if (item.title === 'لم يتم العثور على نتائج في هذه المنطقة') return;
        
        let rowData = [];
        
        if (exportFilter === 'emails') {
          if (!item.email || item.email === 'None') return;
          rowData = [item.title || 'None', item.email || 'None', item.website || 'None'];
        } else if (exportFilter === 'whatsapp') {
          if (!item.whatsapp || item.whatsapp === 'None') return;
          rowData = [item.title || 'None', item.whatsapp || 'None', item.website || 'None'];
        } else if (exportFilter === 'phones') {
          if ((!item.phone || item.phone === 'None') && (!item.extraPhone || item.extraPhone === 'None')) return;
          rowData = [item.title || 'None', item.phone || 'None', item.extraPhone || 'None'];
        } else {
          rowData = [
            item.title || 'None',
            item.rating || 'None',
            item.reviewsCount || 'None',
            item.phone || 'None',
            item.extraPhone || 'None',
            item.whatsapp || 'None',
            item.socials || 'None',
            item.website || 'None',
            item.address || 'None',
            item.email || 'None',
            item.url || 'None'
          ];
        }
        
        csvRows.push(rowData.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','));
      });
    }
    
    const csvString = '\uFEFF' + csvRows.join('\n'); // Added BOM for UTF-8 Arabic support in Excel
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    let filename = type === 'maps' ? 'google_maps_data' : 'web_scraping_data';
    if (exportFilter === 'emails') filename += '_emails';
    if (exportFilter === 'whatsapp') filename += '_whatsapp';
    if (exportFilter === 'phones') filename += '_phones';
    filename += '.csv';

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar glass-panel">
        <div className="logo">
          <i className="fa-solid fa-bolt-lightning glow-icon"></i>
          <span>DataFlow AI</span>
        </div>
        <nav className="nav-menu">
          <a href="#" className={`nav-item ${activeTab === 'web' ? 'active' : ''}`} onClick={() => setActiveTab('web')}>
            <i className="fa-solid fa-earth-americas"></i> استخراج الويب
          </a>
          <a href="#" className={`nav-item ${activeTab === 'maps' ? 'active' : ''}`} onClick={() => setActiveTab('maps')}>
            <i className="fa-solid fa-map-location-dot"></i> خرائط جوجل (API)
          </a>
          <a href="#" className={`nav-item ${activeTab === 'telegram' ? 'active' : ''}`} onClick={() => setActiveTab('telegram')}>
            <i className="fa-brands fa-telegram"></i> تيليجرام (API)
          </a>
          <a href="#" className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
            <i className="fa-solid fa-chart-pie"></i> التحليلات
          </a>
          <a href="#" className={`nav-item ${activeTab === 'emails' ? 'active' : ''}`} onClick={() => setActiveTab('emails')}>
            <i className="fa-solid fa-envelope"></i> البريد الإلكتروني
          </a>
          <a href="#" className={`nav-item ${activeTab === 'yellowpages' ? 'active' : ''}`} onClick={() => setActiveTab('yellowpages')}>
            <i className="fa-solid fa-book"></i> أدلة الأعمال
          </a>
          <a href="#" className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <i className="fa-solid fa-gear"></i> الإعدادات
          </a>
        </nav>
        <div className="user-profile">
          <img src="https://ui-avatars.com/api/?name=Admin&background=random" alt="User" />
          <div className="user-info">
            <span className="user-name">المدير العام</span>
            <span className="user-plan">خطة احترافية PRO</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="topbar">
          <h1>لوحة التحكم <span>/ {
            activeTab === 'web' ? 'استخراج الويب' :
            activeTab === 'maps' ? 'خرائط جوجل' :
            activeTab === 'telegram' ? 'تيليجرام' :
            activeTab === 'analytics' ? 'التحليلات' : 
            activeTab === 'emails' ? 'البريد الإلكتروني' : 
            activeTab === 'yellowpages' ? 'أدلة الأعمال' : 'الإعدادات'
          }</span></h1>
          <div className="topbar-actions">
            <button className="btn btn-icon"><i className="fa-solid fa-bell"></i></button>
            <button className="btn btn-primary"><i className="fa-solid fa-plus"></i> مشروع جديد</button>
          </div>
        </header>

        {activeTab === 'web' && (
        <div className="content-grid">
          {/* Configuration Panel */}
          <section className="config-panel glass-panel">
            <h2>إعدادات الاستخراج</h2>
            <div className="form-group">
              <label>اسم الجلسة (اختياري - سيظهر في التحليلات)</label>
              <input type="text" placeholder="مثال: سحب داتا أطباء الأسنان" className="input-modern" value={sessionName} onChange={e => setSessionName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>الروابط المستهدفة (يمكنك وضع أكثر من رابط، كل رابط في سطر)</label>
              <textarea placeholder="https://example1.com&#10;https://example2.com" className="input-modern" value={url} onChange={e => setUrl(e.target.value)} style={{ height: '100px' }}></textarea>
            </div>
            <div className="form-group">
              <label>خيارات الاستخراج المتاحة</label>
              <div className="options-grid">
                <label className={`option-card ${extractEmails ? 'selected' : ''}`}>
                  <input type="checkbox" checked={extractEmails} onChange={e => setExtractEmails(e.target.checked)} style={{display: 'none'}}/>
                  <i className="fa-solid fa-envelope"></i>
                  <span>الإيميلات</span>
                </label>
                <label className={`option-card ${extractPhones ? 'selected' : ''}`}>
                  <input type="checkbox" checked={extractPhones} onChange={e => setExtractPhones(e.target.checked)} style={{display: 'none'}}/>
                  <i className="fa-solid fa-phone"></i>
                  <span>الأرقام</span>
                </label>
                <label className={`option-card ${extractSocials ? 'selected' : ''}`}>
                  <input type="checkbox" checked={extractSocials} onChange={e => setExtractSocials(e.target.checked)} style={{display: 'none'}}/>
                  <i className="fa-solid fa-share-nodes"></i>
                  <span>السوشيال ميديا</span>
                </label>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>نوع التصدير</label>
                <select className="input-modern">
                  <option>JSON</option>
                  <option>CSV</option>
                  <option>Excel</option>
                </select>
              </div>
              <div className="form-group">
                <label>السرعة</label>
                <select className="input-modern">
                  <option>عادية (آمنة)</option>
                  <option>سريعة</option>
                </select>
              </div>
            </div>
            <button 
              className={`btn w-100 ${status === 'running' ? '' : (status === 'success' ? '' : 'btn-glow')}`} 
              id="start-btn"
              onClick={handleStartScraping}
              disabled={isScraping && status !== 'success'}
              style={{
                background: status === 'success' ? 'var(--success)' : '',
              }}
            >
              {status === 'idle' && <><i className="fa-solid fa-play"></i> بدء الاستخراج</>}
              {status === 'running' && <><i className="fa-solid fa-circle-notch fa-spin"></i> جاري الاستخراج...</>}
              {status === 'success' && <><i className="fa-solid fa-check"></i> اكتمل الاستخراج</>}
            </button>
          </section>

          {/* Results Panel */}
          <section className="results-panel glass-panel">
            <div className="results-header">
              <h2>النتائج المباشرة</h2>
              <div className={`status-badge status-${status}`}>
                {status === 'idle' && 'جاهز للبدء'}
                {status === 'running' && <><i className="fa-solid fa-spinner fa-spin"></i> الذكاء الاصطناعي يقرأ الصفحة</>}
                {status === 'success' && <><i className="fa-solid fa-check-circle"></i> اكتمل بنجاح</>}
              </div>
            </div>
            
            <div className="results-table-container">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>الرابط</th>
                    <th>الحقل</th>
                    <th>القيمة المستخرجة</th>
                    <th>الثقة (AI)</th>
                  </tr>
                </thead>
                <tbody>
                  {status === 'idle' && results.length === 0 && (
                    <tr>
                      <td colSpan="4" className="empty-state">
                        <i className="fa-solid fa-robot"></i>
                        <p>أدخل الرابط واطلب البيانات لبدء الذكاء الاصطناعي بالعمل.</p>
                      </td>
                    </tr>
                  )}
                  {status === 'running' && results.length === 0 && (
                    <tr>
                      <td colSpan="4" className="empty-state">
                        <i className="fa-solid fa-network-wired fa-fade"></i>
                        <p>جاري تحليل هيكل الموقع واستخراج البيانات المطلوبة...</p>
                      </td>
                    </tr>
                  )}
                  {results.map((item, index) => (
                    <tr key={item.id} style={{ animation: 'fadeIn 0.5s ease' }}>
                      <td>{item.id}</td>
                      <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.url}>{item.url}</td>
                      <td style={{ fontWeight: 600, color: 'var(--secondary)' }}>{item.field}</td>
                      <td>{item.value}</td>
                      <td>
                        <span style={{ 
                          color: 'var(--success)', 
                          background: 'rgba(16,185,129,0.1)', 
                          padding: '4px 8px', 
                          borderRadius: '12px', 
                          fontSize: '12px' 
                        }}>
                          {item.confidence}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="results-footer">
              <button className="btn btn-secondary" onClick={handleExportCSV}>
                <i className="fa-solid fa-download"></i> تصدير البيانات (CSV)
              </button>
            </div>
          </section>
        </div>
        )}

        {activeTab === 'maps' && (
        <div className="content-vertical">
          {/* Configuration Panel for Maps */}
          <section className="config-panel glass-panel">
            <h2>إعدادات خرائط جوجل</h2>
            <div className="form-group">
              <label>اسم الجلسة (اختياري - للتمييز في التحليلات)</label>
              <input type="text" placeholder="مثال: داتا المطاعم في جدة" className="input-modern" value={sessionName} onChange={e => setSessionName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>الكلمات المفتاحية (يمكنك البحث بأكثر من كلمة، كل كلمة في سطر)</label>
              <textarea placeholder="مثال: فنادق&#10;مطاعم&#10;صيدليات" className="input-modern" value={mapQuery} onChange={e => setMapQuery(e.target.value)} style={{ height: '100px' }}></textarea>
            </div>
            <div className="form-group">
              <label>الموقع الجغرافي (المدينة أو المنطقة)</label>
              <input type="text" placeholder="مثال: دبي، الرياض، القاهرة..." className="input-modern" value={mapLocation} onChange={e => setMapLocation(e.target.value)} />
            </div>
            <div className="form-group">
              <label>خيارات الاستخراج (Google Places)</label>
              <div className="options-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <label className={`option-card ${mapReviews ? 'selected' : ''}`}>
                  <input type="checkbox" checked={mapReviews} onChange={e => setMapReviews(e.target.checked)} style={{display: 'none'}}/>
                  <i className="fa-solid fa-star"></i>
                  <span>التقييمات والمراجعات</span>
                </label>
                <label className={`option-card ${mapPhones ? 'selected' : ''}`}>
                  <input type="checkbox" checked={mapPhones} onChange={e => setMapPhones(e.target.checked)} style={{display: 'none'}}/>
                  <i className="fa-solid fa-phone"></i>
                  <span>أرقام الهواتف</span>
                </label>
                <label className={`option-card ${mapWebsites ? 'selected' : ''}`}>
                  <input type="checkbox" checked={mapWebsites} onChange={e => setMapWebsites(e.target.checked)} style={{display: 'none'}}/>
                  <i className="fa-solid fa-globe"></i>
                  <span>المواقع الإلكترونية</span>
                </label>
                <label className={`option-card ${mapAddress ? 'selected' : ''}`}>
                  <input type="checkbox" checked={mapAddress} onChange={e => setMapAddress(e.target.checked)} style={{display: 'none'}}/>
                  <i className="fa-solid fa-map-pin"></i>
                  <span>العنوان التفصيلي</span>
                </label>
              </div>
            </div>
            <button 
              className={`btn w-100 ${status === 'running' ? '' : (status === 'success' ? '' : 'btn-glow')}`} 
              id="start-btn-maps"
              onClick={handleStartMapsScraping}
              disabled={isScraping && status !== 'success'}
              style={{
                background: status === 'success' ? 'var(--success)' : '',
              }}
            >
              {status === 'idle' && <><i className="fa-solid fa-play"></i> بدء البحث في الخرائط</>}
              {status === 'running' && <><i className="fa-solid fa-circle-notch fa-spin"></i> جاري استخراج الأماكن...</>}
              {status === 'success' && <><i className="fa-solid fa-check"></i> اكتمل الاستخراج</>}
            </button>
          </section>

          {/* Results Panel */}
          <section className="results-panel glass-panel">
            <div className="results-header">
              <h2>نتائج خرائط جوجل</h2>
              <div className={`status-badge status-${status}`}>
                {status === 'idle' && 'جاهز للبحث'}
                {status === 'running' && <><i className="fa-solid fa-spinner fa-spin"></i> الذكاء الاصطناعي يبحث في الخرائط</>}
                {status === 'success' && <><i className="fa-solid fa-check-circle"></i> تم العثور على الأماكن</>}
              </div>
            </div>
            
            <div className="results-table-container">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>اسم المكان (Title)</th>
                    {mapReviews && <th>التقييم (Rating)</th>}
                    {mapPhones && <th>رقم الهاتف (Phone)</th>}
                    <th>رقم إضافي (Extra Phone)</th>
                    <th>واتساب (WhatsApp)</th>
                    <th>سوشيال ميديا (Socials)</th>
                    {mapWebsites && <th>الموقع (Website)</th>}
                    {mapAddress && <th>العنوان (Address)</th>}
                    <th>البريد الإلكتروني (Email)</th>
                    <th>رابط الخريطة</th>
                  </tr>
                </thead>
                <tbody>
                  {status === 'idle' && results.length === 0 && (
                    <tr>
                      <td colSpan="8" className="empty-state">
                        <i className="fa-solid fa-map-location-dot"></i>
                        <p>أدخل الكلمة المفتاحية والمدينة لبدء سحب بيانات الشركات والأماكن.</p>
                      </td>
                    </tr>
                  )}
                  {status === 'running' && !isDeepScraping && results.length === 0 && (
                    <tr>
                      <td colSpan="8" className="empty-state">
                        <i className="fa-solid fa-satellite-dish fa-fade"></i>
                        <p>جاري مسح خرائط جوجل للمنطقة المحددة وتجميع البيانات...</p>
                      </td>
                    </tr>
                  )}
                  {results.slice((currentPage - 1) * 10, currentPage * 10).map((item, index) => (
                    <tr key={item.id} style={{ animation: 'fadeIn 0.5s ease' }}>
                      <td>{item.id}</td>
                      <td style={{ fontWeight: 600, color: 'var(--text-color)' }}>{item.title}</td>
                      {mapReviews && <td>{item.rating !== 'N/A' && item.rating !== 'None' ? <>{item.rating} <i className="fa-solid fa-star" style={{color: '#fbbf24', fontSize: '12px'}}></i> ({item.reviewsCount})</> : 'None'}</td>}
                      {mapPhones && <td>{item.phone}</td>}
                      <td>
                        {item.extraPhone && item.extraPhone !== 'None' ? <span style={{color: 'var(--success)'}}>{item.extraPhone}</span> : <span style={{color: 'var(--text-muted)'}}>None</span>}
                      </td>
                      <td>
                        {item.whatsapp && item.whatsapp !== 'None' ? <span style={{color: '#25D366'}}><i className="fa-brands fa-whatsapp"></i> {item.whatsapp.split(' , ')[0]}</span> : <span style={{color: 'var(--text-muted)'}}>None</span>}
                      </td>
                      <td>
                        {item.socials && item.socials !== 'None' ? (
                          <div style={{display: 'flex', gap: '8px'}}>
                            {item.socials.split(' , ').map((link, i) => {
                              if (link.includes('facebook')) return <a key={i} href={link} target="_blank" title="Facebook"><i className="fa-brands fa-facebook" style={{color: '#1877F2', fontSize: '18px'}}></i></a>;
                              if (link.includes('twitter') || link.includes('x.com')) return <a key={i} href={link} target="_blank" title="X/Twitter"><i className="fa-brands fa-x-twitter" style={{color: '#fff', fontSize: '18px'}}></i></a>;
                              if (link.includes('instagram')) return <a key={i} href={link} target="_blank" title="Instagram"><i className="fa-brands fa-instagram" style={{color: '#E4405F', fontSize: '18px'}}></i></a>;
                              if (link.includes('linkedin')) return <a key={i} href={link} target="_blank" title="LinkedIn"><i className="fa-brands fa-linkedin" style={{color: '#0A66C2', fontSize: '18px'}}></i></a>;
                              if (link.includes('youtube')) return <a key={i} href={link} target="_blank" title="YouTube"><i className="fa-brands fa-youtube" style={{color: '#FF0000', fontSize: '18px'}}></i></a>;
                              if (link.includes('tiktok')) return <a key={i} href={link} target="_blank" title="TikTok"><i className="fa-brands fa-tiktok" style={{color: '#fff', fontSize: '18px'}}></i></a>;
                              return <a key={i} href={link} target="_blank" title="رابط"><i className="fa-solid fa-link" style={{color: 'var(--text-muted)', fontSize: '16px'}}></i></a>;
                            })}
                          </div>
                        ) : <span style={{color: 'var(--text-muted)'}}>None</span>}
                      </td>
                      {mapWebsites && <td>{item.website !== 'N/A' && item.website !== 'غير متوفر' && item.website !== 'None' ? <a href={item.website} target="_blank" rel="noreferrer" style={{color: 'var(--secondary)'}}>زيارة الموقع</a> : 'None'}</td>}
                      {mapAddress && <td>{item.address}</td>}
                      <td>
                        {item.email ? <span style={{color: 'var(--success)'}}>{item.email}</span> : <span style={{color: 'var(--text-muted)'}}>-</span>}
                      </td>
                      <td>
                        <a href={item.url} target="_blank" rel="noreferrer" className="btn btn-icon" style={{background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', width: '32px', height: '32px'}}>
                          <i className="fa-solid fa-map-location-dot"></i>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {results.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '15px' }}>
                <button className="btn btn-secondary" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><i className="fa-solid fa-angle-right"></i> السابق</button>
                <span style={{ padding: '10px 15px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                  صفحة {currentPage} من {Math.ceil(results.length / 10) || 1}
                </span>
                <button className="btn btn-secondary" disabled={currentPage >= Math.ceil(results.length / 10)} onClick={() => setCurrentPage(p => p + 1)}>التالي <i className="fa-solid fa-angle-left"></i></button>
              </div>
            )}
            
            <div className="results-footer" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-secondary" onClick={() => alert('ميزة التحليل قريباً!')}>
                  <i className="fa-solid fa-brain"></i> تحليل الذكاء الاصطناعي (AI)
                </button>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-secondary" onClick={handleCleanData} disabled={results.length === 0} style={{ color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.1)' }}>
                  <i className="fa-solid fa-broom"></i> تنظيف الداتا
                </button>
                <button className="btn btn-primary" onClick={handleDeepScrape} disabled={isDeepScraping || results.length === 0} style={{ background: 'var(--success)' }}>
                  {isDeepScraping ? <><i className="fa-solid fa-spinner fa-spin"></i> جاري الاستخراج...</> : <><i className="fa-solid fa-magnifying-glass-plus"></i> استخراج الإيميلات من المواقع</>}
                </button>
                <button className="btn btn-secondary" onClick={() => handleExportCSV()}>
                  <i className="fa-solid fa-download"></i> تصدير البيانات (CSV)
                </button>
              </div>
            </div>
          </section>
        </div>
        )}

        {activeTab === 'analytics' && (
          <div className="content-vertical" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', animation: 'fadeIn 0.4s ease' }}>
            
            {/* Global Dashboard Cards */}
            <div className="stats-grid" style={{ marginBottom: '30px' }}>
                <div className="stat-card">
                  <div className="stat-icon" style={{background: 'rgba(124, 58, 237, 0.1)', color: 'var(--primary)'}}>
                    <i className="fa-solid fa-server"></i>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">{history.length}</span>
                    <span className="stat-label">إجمالي الجلسات</span>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon" style={{background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6'}}>
                    <i className="fa-solid fa-map-location-dot"></i>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">{history.reduce((a,c) => a + (c.data?.length || 0), 0)}</span>
                    <span className="stat-label">أماكن تم فحصها</span>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)'}}>
                    <i className="fa-solid fa-envelope"></i>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">{history.reduce((a,c) => a + (c.data ? c.data.filter(r=>r.email && r.email!=='None').length : 0), 0)}</span>
                    <span className="stat-label">إيميلات مجمعة</span>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{background: 'rgba(37, 211, 102, 0.1)', color: '#25D366'}}>
                    <i className="fa-brands fa-whatsapp"></i>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">{history.reduce((a,c) => a + (c.data ? c.data.filter(r=>r.whatsapp && r.whatsapp!=='None').length : 0), 0)}</span>
                    <span className="stat-label">أرقام واتساب</span>
                  </div>
                </div>
            </div>

            {/* Sessions Table */}
            <div className="glass-panel" style={{ padding: '30px' }}>
              <h2 style={{ marginBottom: '20px' }}><i className="fa-solid fa-clock-rotate-left" style={{color: 'var(--primary)'}}></i> سجل الجلسات السابقة (محفوظ محلياً)</h2>
              <div className="table-responsive">
                <table className="modern-table" style={{ width: '100%' }}>
                  <thead style={{ textAlign: 'center' }}>
                    <tr>
                      <th style={{ textAlign: 'center' }}>اسم الجلسة</th>
                      <th style={{ textAlign: 'center' }}>تاريخ الجلسة</th>
                      <th style={{ textAlign: 'center' }}>النوع</th>
                      <th style={{ textAlign: 'center' }}>الكلمات المفتاحية / الروابط</th>
                      <th style={{ textAlign: 'center' }}>إجمالي النتائج</th>
                      <th style={{ textAlign: 'center' }}>إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((session, index) => (
                      <tr key={index} style={{ animation: `fadeIn ${0.3 + (index * 0.1)}s ease` }}>
                        <td style={{ fontWeight: 'bold', color: 'var(--primary)', textAlign: 'center' }}>{session.sessionName || '-'}</td>
                        <td style={{ direction: 'ltr', textAlign: 'center', fontSize: '13px' }}>{session.date}</td>
                        <td style={{ textAlign: 'center' }}>{session.type === 'maps' ? <><i className="fa-solid fa-map-location-dot" style={{color: '#3b82f6'}}></i> خرائط</> : <><i className="fa-solid fa-globe" style={{color: 'var(--primary)'}}></i> عام</>}</td>
                        <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px', textAlign: 'center' }}>
                          {session.query}
                        </td>
                        <td style={{ color: 'var(--success)', fontWeight: 'bold', textAlign: 'center' }}>{session.data ? session.data.length : 0} نتيجة</td>
                        <td style={{ display: 'flex', gap: '10px', justifyContent: 'center', alignItems: 'center' }}>
                          <button 
                            className="btn btn-outline" 
                            title="عرض التقرير والبيانات"
                            onClick={() => setSelectedSession(session)}
                            style={{ padding: '8px 12px', fontSize: '14px' }}
                          >
                            <i className="fa-solid fa-eye"></i> عرض
                          </button>
                          <button 
                            className="btn btn-outline" 
                            title="تحميل البيانات"
                            onClick={() => handleExportCSV(session.data, session.type)}
                            style={{ padding: '8px 12px', fontSize: '14px' }}
                            disabled={!session.data || session.data.length === 0}
                          >
                            <i className="fa-solid fa-download"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {history.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--text-muted)' }}>
                          <i className="fa-solid fa-box-open" style={{ fontSize: '64px', marginBottom: '20px', display: 'block', opacity: 0.3 }}></i>
                          لا توجد بيانات محفوظة حتى الآن. قم ببدء البحث الأول!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'telegram' && (
          <div className="content-vertical" style={{ animation: 'fadeIn 0.4s ease' }}>
            <TelegramDashboard />
          </div>
        )}



        {activeTab === 'settings' && (
          <div className="glass-panel" style={{ padding: '40px', maxWidth: '800px', margin: '20px auto' }}>
            <h2 style={{ marginBottom: '20px' }}><i className="fa-solid fa-server" style={{color: 'var(--primary)'}}></i> إعدادات خادم البريد (SMTP)</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>قم بإدخال بيانات خادم الإرسال الخاص بك (مثل Hostinger أو Gmail) لتتمكن من إرسال حملات البريد الإلكتروني.</p>
            
            <form onSubmit={handleSaveSmtp} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="form-row">
                <div className="form-group flex-1">
                  <label>خادم SMTP (Host)</label>
                  <input type="text" className="input-modern" required placeholder="smtp.hostinger.com أو smtp.gmail.com" value={smtpSettings.host} onChange={e => setSmtpSettings({...smtpSettings, host: e.target.value})} />
                </div>
                <div className="form-group flex-1">
                  <label>المنفذ (Port)</label>
                  <input type="text" className="input-modern" required placeholder="465 أو 587" value={smtpSettings.port} onChange={e => setSmtpSettings({...smtpSettings, port: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label>البريد الإلكتروني (User/Email)</label>
                <input type="email" className="input-modern" required placeholder="info@yourdomain.com" value={smtpSettings.user} onChange={e => setSmtpSettings({...smtpSettings, user: e.target.value})} />
              </div>
              <div className="form-group">
                <label>كلمة المرور (Password)</label>
                <input type="password" className="input-modern" required placeholder="كلمة مرور البريد أو App Password" value={smtpSettings.pass} onChange={e => setSmtpSettings({...smtpSettings, pass: e.target.value})} />
              </div>
              <button type="submit" className="btn btn-primary w-100 btn-glow" style={{ marginTop: '10px' }}>
                <i className="fa-solid fa-floppy-disk"></i> حفظ الإعدادات
              </button>
            </form>
          </div>
        )}

        {activeTab === 'emails' && (
          <EmailsPage />
        )}

        {activeTab === 'yellowpages' && (
          <YellowPagesDashboard />
        )}
      </main>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Report Modal */}
      {showReport && reportData && (
        <div className="modal-overlay" onClick={() => setShowReport(false)}>
          <div className="report-modal" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowReport(false)}>
              <i className="fa-solid fa-xmark"></i>
            </button>
            <div className="report-header">
              <h2><i className="fa-solid fa-chart-pie" style={{color: 'var(--primary)'}}></i> تقرير الاستخراج العميق</h2>
              <p>تم الانتهاء من فحص المواقع واستخراج البيانات بنجاح</p>
            </div>
            
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon" style={{background: 'rgba(124, 58, 237, 0.1)', color: 'var(--primary)'}}>
                  <i className="fa-solid fa-map-location-dot"></i>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{reportData.total}</span>
                  <span className="stat-label">إجمالي الأماكن</span>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon" style={{background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)'}}>
                  <i className="fa-solid fa-envelope"></i>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{reportData.withEmail}</span>
                  <span className="stat-label">إيميلات مستخرجة</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon" style={{background: 'rgba(37, 211, 102, 0.1)', color: '#25D366'}}>
                  <i className="fa-brands fa-whatsapp"></i>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{reportData.withWhatsapp}</span>
                  <span className="stat-label">أرقام واتساب</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon" style={{background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6'}}>
                  <i className="fa-solid fa-share-nodes"></i>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{reportData.withSocials}</span>
                  <span className="stat-label">حسابات تواصل</span>
                </div>
              </div>
            </div>

            <div className="report-actions">
              <button className="btn btn-primary w-100" onClick={() => { setShowReport(false); handleExportCSV(); }}>
                <i className="fa-solid fa-download"></i> تصدير البيانات (CSV)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Details Modal */}
      {selectedSession && (
        <div className="modal-overlay" onClick={() => setSelectedSession(null)}>
          <div className="report-modal" style={{ maxWidth: '1000px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedSession(null)}>
              <i className="fa-solid fa-xmark"></i>
            </button>
            <div className="report-header" style={{ marginBottom: '20px' }}>
              <h2><i className="fa-solid fa-file-invoice" style={{color: 'var(--primary)'}}></i> تقرير الجلسة</h2>
              <p>{selectedSession?.query || 'بدون اسم'}</p>
            </div>
            
            <div className="stats-grid" style={{ marginBottom: '20px' }}>
              <div className="stat-card" style={{ padding: '15px' }}>
                <div className="stat-icon" style={{width: '40px', height: '40px', fontSize: '20px', background: 'rgba(124, 58, 237, 0.1)', color: 'var(--primary)'}}>
                  <i className="fa-solid fa-map-location-dot"></i>
                </div>
                <div className="stat-info">
                  <span className="stat-value" style={{fontSize: '20px'}}>{Array.isArray(selectedSession?.data) ? selectedSession.data.length : 0}</span>
                  <span className="stat-label">أماكن</span>
                </div>
              </div>
              
              <div className="stat-card" style={{ padding: '15px' }}>
                <div className="stat-icon" style={{width: '40px', height: '40px', fontSize: '20px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)'}}>
                  <i className="fa-solid fa-envelope"></i>
                </div>
                <div className="stat-info">
                  <span className="stat-value" style={{fontSize: '20px'}}>{Array.isArray(selectedSession?.data) ? selectedSession.data.filter(r => r && r.email && r.email !== 'None').length : 0}</span>
                  <span className="stat-label">إيميلات</span>
                </div>
              </div>

              <div className="stat-card" style={{ padding: '15px' }}>
                <div className="stat-icon" style={{width: '40px', height: '40px', fontSize: '20px', background: 'rgba(37, 211, 102, 0.1)', color: '#25D366'}}>
                  <i className="fa-brands fa-whatsapp"></i>
                </div>
                <div className="stat-info">
                  <span className="stat-value" style={{fontSize: '20px'}}>{Array.isArray(selectedSession?.data) ? selectedSession.data.filter(r => r && r.whatsapp && r.whatsapp !== 'None').length : 0}</span>
                  <span className="stat-label">واتساب</span>
                </div>
              </div>

              <div className="stat-card" style={{ padding: '15px' }}>
                <div className="stat-icon" style={{width: '40px', height: '40px', fontSize: '20px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6'}}>
                  <i className="fa-solid fa-share-nodes"></i>
                </div>
                <div className="stat-info">
                  <span className="stat-value" style={{fontSize: '20px'}}>{Array.isArray(selectedSession?.data) ? selectedSession.data.filter(r => r && r.socials && r.socials !== 'None').length : 0}</span>
                  <span className="stat-label">تواصل</span>
                </div>
              </div>
            </div>

            <div className="table-responsive" style={{ flexGrow: 1, overflowY: 'auto', minHeight: 0, border: '1px solid var(--border-glass)', borderRadius: '12px', background: 'rgba(0,0,0,0.2)' }}>
              <table className="modern-table" style={{ fontSize: '13px', width: '100%' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-glass)', textAlign: 'center' }}>
                  <tr>
                    <th style={{ textAlign: 'center' }}>الاسم</th>
                    <th style={{ textAlign: 'center' }}>هاتف</th>
                    <th style={{ textAlign: 'center' }}>واتساب</th>
                    <th style={{ textAlign: 'center' }}>إيميل</th>
                    <th style={{ textAlign: 'center' }}>سوشيال</th>
                    <th style={{ textAlign: 'center' }}>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(selectedSession?.data) && selectedSession.data.map((item, i) => (
                    item && <tr key={i}>
                      <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }} title={String(item.title || '')}>{String(item.title || '-')}</td>
                      <td style={{ textAlign: 'center', direction: 'ltr' }}>{String(item.phone || '-')}</td>
                      <td style={{ textAlign: 'center' }}>{item.whatsapp && item.whatsapp !== 'None' ? <span style={{color: '#25D366'}} title={String(item.whatsapp)}>✔</span> : <span style={{color: 'var(--text-muted)'}}>-</span>}</td>
                      <td style={{ textAlign: 'center' }}>{item.email && item.email !== 'None' ? <span style={{color: 'var(--success)'}} title={String(item.email)}>✔</span> : <span style={{color: 'var(--text-muted)'}}>-</span>}</td>
                      <td style={{ textAlign: 'center' }}>{item.socials && item.socials !== 'None' ? <span style={{color: 'var(--secondary)'}} title={String(item.socials)}>✔</span> : <span style={{color: 'var(--text-muted)'}}>-</span>}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          className="btn btn-outline" 
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                          onClick={() => handleDeepScrapeSingle(item, i)}
                          disabled={scrapingItemId === i || (!item.website || item.website === 'None')}
                          title={!item.website || item.website === 'None' ? 'لا يوجد موقع إلكتروني' : 'سحب الإيميل والروابط من الموقع'}
                        >
                          {scrapingItemId === i ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-satellite-dish"></i>} سحب
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!selectedSession?.data || !Array.isArray(selectedSession.data) || selectedSession.data.length === 0) && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>لا توجد بيانات مسحوبة.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="report-actions" style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <button className="btn btn-outline flex-1" style={{ fontSize: '12px', padding: '10px' }} onClick={() => handleExportCSV(selectedSession.data, selectedSession.type, 'emails')} title="ينزل ملف فيه الأسماء والإيميلات فقط">
                <i className="fa-solid fa-envelope"></i> تحميل الإيميلات
              </button>
              <button className="btn btn-outline flex-1" style={{ fontSize: '12px', padding: '10px' }} onClick={() => handleExportCSV(selectedSession.data, selectedSession.type, 'whatsapp')} title="ينزل ملف فيه الأسماء وأرقام الواتساب فقط">
                <i className="fa-brands fa-whatsapp"></i> تحميل الواتساب
              </button>
              <button className="btn btn-outline flex-1" style={{ fontSize: '12px', padding: '10px' }} onClick={() => handleExportCSV(selectedSession.data, selectedSession.type, 'phones')} title="ينزل ملف فيه الأسماء والأرقام فقط">
                <i className="fa-solid fa-phone"></i> تحميل الأرقام
              </button>
              <button className="btn btn-primary flex-1" style={{ fontSize: '12px', padding: '10px', background: '#0ea5e9' }} onClick={() => handleBulkScrape('all')} disabled={isBulkScraping} title="للبحث واستخراج المزيد من البيانات للمنشآت">
                <i className="fa-solid fa-satellite-dish"></i> استخراج بيانات مفقودة
              </button>
              <button className="btn btn-primary flex-1" style={{ fontSize: '12px', padding: '10px' }} onClick={() => handleExportCSV(selectedSession.data, selectedSession.type, 'all')} title="تنزيل الجدول كامل بالاكسيل">
                <i className="fa-solid fa-file-excel"></i> تحميل التقرير الشامل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
