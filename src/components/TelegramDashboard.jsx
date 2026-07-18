import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

const fetch = async (url, options) => {
  const finalUrl = typeof url === 'string' && url.startsWith('http://localhost:3000')
    ? url.replace('http://localhost:3000', API_BASE_URL)
    : url;
  return window.fetch(finalUrl, options);
};

const TelegramDashboard = () => {
  const [activeTab, setActiveTab] = useState('accounts');
  
  // Accounts State
  const [accounts, setAccounts] = useState([]);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState(1); // 1: input phone, 2: input code
  const [authStatus, setAuthStatus] = useState('');

  // Scraper State
  const [sourceGroup, setSourceGroup] = useState('');
  const [scrapedMembers, setScrapedMembers] = useState([]);
  const [isScraping, setIsScraping] = useState(false);
  const [selectedAccountToScrape, setSelectedAccountToScrape] = useState('');
  const [scrapeMetadata, setScrapeMetadata] = useState(null);
  const [savedFolders, setSavedFolders] = useState([]);

  // Adder State
  const [targetGroup, setTargetGroup] = useState('');
  const [delay, setDelay] = useState(30);
  const [isAdding, setIsAdding] = useState(false);
  const [isAddConfirmOpen, setIsAddConfirmOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [liveTask, setLiveTask] = useState(null);

  // Settings State
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Modal State
  const [accountToDelete, setAccountToDelete] = useState(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // History State
  const [historyTasks, setHistoryTasks] = useState([]);

  useEffect(() => {
    fetchAccounts();
    fetchSettings();
    fetchFolders();
    fetchActiveTask();
    fetchHistoryTasks();
  }, []);

  const fetchActiveTask = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/telegram/tasks/active');
      const data = await res.json();
      if (data.success && data.task) {
        setLiveTask(data.task);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHistoryTasks = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/telegram/tasks/history');
      const data = await res.json();
      setHistoryTasks(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    let interval;
    if (liveTask && !['completed', 'error', 'cancelled'].includes(liveTask.status)) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`http://localhost:3000/api/telegram/task/${liveTask.id}`);
          const data = await res.json();
          if (data.success) {
            setLiveTask({ id: liveTask.id, ...data.task });
          }
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [liveTask]);

  const handlePauseTask = async () => {
      try {
          await fetch(`http://localhost:3000/api/telegram/task/${liveTask.id}/pause`, { method: 'POST' });
          setLiveTask({ ...liveTask, status: 'paused' });
      } catch (e) {
          console.error(e);
      }
  };

  const handleResumeTask = async () => {
      try {
          await fetch(`http://localhost:3000/api/telegram/task/${liveTask.id}/resume`, { method: 'POST' });
          setLiveTask({ ...liveTask, status: 'running' });
      } catch (e) {
          console.error(e);
      }
  };

  const handleCancelTask = async () => {
      if (!confirm('هل أنت متأكد من إلغاء العملية تماماً؟')) return;
      try {
          await fetch(`http://localhost:3000/api/telegram/task/${liveTask.id}/cancel`, { method: 'POST' });
          setLiveTask({ ...liveTask, status: 'cancelled' });
      } catch (e) {
          console.error(e);
      }
  };

  const fetchFolders = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/telegram/folders');
      const data = await res.json();
      setSavedFolders(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/telegram/settings');
      const data = await res.json();
      if (data.api_id) setApiId(data.api_id.toString());
      if (data.api_hash) setApiHash(data.api_hash);
    } catch (e) {
      console.error("Error fetching settings", e);
    }
  };

  const saveSettings = async () => {
    try {
      await fetch('http://localhost:3000/api/telegram/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_id: apiId, api_hash: apiHash })
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (e) {
      alert('حدث خطأ أثناء حفظ الإعدادات');
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/telegram/accounts');
      const data = await res.json();
      setAccounts(data);
      if (data.length > 0 && !selectedAccountToScrape) {
        setSelectedAccountToScrape(data[0].phone);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendCode = async () => {
    if (!phone) return;
    setAuthStatus('جاري إرسال الكود...');
    try {
      const res = await fetch('http://localhost:3000/api/telegram/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      if (data.success) {
        setStep(2);
        setAuthStatus('تم إرسال الكود! الرجاء إدخاله أدناه.');
      } else {
        setAuthStatus('خطأ: ' + data.error);
      }
    } catch (e) {
      setAuthStatus('حدث خطأ بالاتصال.');
    }
  };

  const handleVerifyCode = async () => {
    if (!code) return;
    setAuthStatus('جاري التحقق من الكود...');
    try {
      const res = await fetch('http://localhost:3000/api/telegram/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code })
      });
      const data = await res.json();
      if (data.success) {
        setAuthStatus('تم تسجيل الدخول بنجاح!');
        setStep(1);
        setPhone('');
        setCode('');
        fetchAccounts();
      } else {
        setAuthStatus('خطأ: ' + data.error);
      }
    } catch (e) {
      setAuthStatus('حدث خطأ بالاتصال.');
    }
  };

  const handleRemoveAccount = (accPhone) => {
    setAccountToDelete(accPhone);
  };

  const confirmRemoveAccount = async () => {
    if (!accountToDelete) return;
    try {
      await fetch('http://localhost:3000/api/telegram/remove-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: accountToDelete })
      });
      setAccountToDelete(null);
      fetchAccounts();
    } catch (e) {
      console.error(e);
    }
  };

  const handleScrape = async () => {
    if (!sourceGroup || !selectedAccountToScrape) return;
    setIsScraping(true);
    setScrapedMembers([]);
    try {
      const res = await fetch('http://localhost:3000/api/telegram/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: selectedAccountToScrape, groupUrl: sourceGroup, metadata: scrapeMetadata })
      });
      const data = await res.json();
      if (data.success) {
        setScrapedMembers(data.members);
        fetchFolders(); // Refresh folders
        alert(`تم سحب ${data.members.length} عضو بنجاح! تم حفظ المجلد.`);
      } else {
        alert('خطأ أثناء السحب: ' + data.error);
      }
    } catch (e) {
      alert('خطأ بالاتصال بالخادم.');
    }
    setIsScraping(false);
  };

  const handleAddMembers = () => {
    if (!targetGroup || scrapedMembers.length === 0) {
        alert('يرجى التأكد من وجود جروب هدف وتوفر أعضاء مسحوبين.');
        return;
    }
    setIsAddConfirmOpen(true);
  };

  const confirmAddMembers = async () => {
    setIsAddConfirmOpen(false);
    setIsAdding(true);
    setLiveTask(null);
    try {
      const res = await fetch('http://localhost:3000/api/telegram/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetGroupUrl: targetGroup, members: scrapedMembers, delaySeconds: delay })
      });
      const data = await res.json();
      if (data.success) {
        setLiveTask({ id: data.taskId, status: 'running', added: 0, failed: 0, remaining: scrapedMembers.length, total: scrapedMembers.length, logs: [] });
      } else {
        alert('حدث خطأ: ' + data.error);
        setIsAdding(false);
      }
    } catch (e) {
      alert('حدث خطأ بالاتصال.');
      setIsAdding(false);
    }
  };

  const handleExportMembers = () => {
      if (scrapedMembers.length === 0) return;
      let csv = 'ID,Username,FirstName,LastName,Phone\n';
      scrapedMembers.forEach(m => {
          csv += `"${m.id}","${m.username}","${m.firstName}","${m.lastName}","${m.phone}"\n`;
      });
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'telegram_members.csv');
      link.click();
  };

  const handleExportReport = (task) => {
      if (!task.processedMembers || task.processedMembers.length === 0) {
          alert('لا يوجد تقرير مفصل لهذه العملية.');
          return;
      }
      let csv = 'ID,Username,FirstName,LastName,Status,Error,Date\n';
      task.processedMembers.forEach(m => {
          csv += `"${m.id}","${m.username}","${m.firstName}","${m.lastName}","${m.status}","${m.error || ''}","${m.date}"\n`;
      });
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `report_${task.id}.csv`);
      link.click();
  };

  const handleSearchGroups = async () => {
    if (!searchQuery || !selectedAccountToScrape) {
        alert("يرجى التأكد من كتابة كلمة للبحث واختيار حساب للبحث من قائمة 'سحب الأعضاء' أولاً.");
        return;
    }
    setIsSearching(true);
    setHasSearched(false);
    setSearchResults([]);
    try {
      const res = await fetch('http://localhost:3000/api/telegram/search-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: selectedAccountToScrape, query: searchQuery })
      });
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.groups);
      } else {
        alert('حدث خطأ: ' + data.error);
      }
    } catch (e) {
      alert('حدث خطأ بالاتصال.');
    }
    setIsSearching(false);
    setHasSearched(true);
  };

  const sendToScraper = (url, title) => {
    setSourceGroup(url);
    setScrapeMetadata({ keyword: searchQuery, title });
    setActiveTab('scraper');
  };

  return (
    <div className="telegram-dashboard">
      <div className="telegram-nav" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button className={`btn ${activeTab === 'accounts' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('accounts')}>
            <i className="fa-solid fa-users-gear"></i> إدارة الحسابات
        </button>
        <button className={`btn ${activeTab === 'search' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('search')}>
            <i className="fa-solid fa-magnifying-glass"></i> بحث المجموعات
        </button>
        <button className={`btn ${activeTab === 'scraper' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('scraper')}>
            <i className="fa-solid fa-spider"></i> سحب الأعضاء
        </button>
        <button className={`btn ${activeTab === 'adder' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('adder')}>
            <i className="fa-solid fa-user-plus"></i> إضافة الأعضاء
        </button>
        <button className={`btn ${activeTab === 'reports' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setActiveTab('reports'); fetchHistoryTasks(); }}>
            <i className="fa-solid fa-file-contract"></i> سجل العمليات
        </button>
        <button className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('settings')}>
            <i className="fa-solid fa-gear"></i> إعدادات الربط
        </button>
      </div>

      {activeTab === 'accounts' && (
        <section className="glass-panel" style={{ animation: 'fadeIn 0.3s ease' }}>
          <h2 style={{ marginBottom: '20px' }}><i className="fa-solid fa-users-gear" style={{color: '#0ea5e9'}}></i> الحسابات المسجلة</h2>
          <div className="accounts-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="add-account-card" style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                <h3>إضافة حساب جديد</h3>
                {step === 1 ? (
                    <div style={{ marginTop: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>رقم الهاتف (مع الرمز الدولي +)</label>
                        <input type="text" className="input-modern" placeholder="+1234567890" value={phone} onChange={e => setPhone(e.target.value)} />
                        <button className="btn btn-primary w-100" style={{ marginTop: '15px' }} onClick={handleSendCode}>إرسال كود التفعيل</button>
                    </div>
                ) : (
                    <div style={{ marginTop: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>الكود المرسل عبر تيليجرام</label>
                        <input type="text" className="input-modern" placeholder="12345" value={code} onChange={e => setCode(e.target.value)} />
                        <button className="btn btn-primary w-100" style={{ marginTop: '15px' }} onClick={handleVerifyCode}>تحقق وتسجيل الدخول</button>
                        <button className="btn btn-secondary w-100" style={{ marginTop: '10px' }} onClick={() => setStep(1)}>إلغاء</button>
                    </div>
                )}
                {authStatus && <p style={{ marginTop: '10px', color: 'var(--accent)', fontSize: '13px' }}>{authStatus}</p>}
            </div>

            <div className="accounts-list-card" style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-glass)', overflowY: 'auto', maxHeight: '300px' }}>
                <h3>الحسابات الحالية ({accounts.length})</h3>
                <ul style={{ listStyle: 'none', padding: 0, marginTop: '15px' }}>
                    {accounts.length === 0 ? <li style={{color: 'var(--text-muted)'}}>لا يوجد حسابات متصلة.</li> : null}
                    {accounts.map((acc, i) => {
                        const isBanned = acc.stats && acc.stats.floodWaitUntil && new Date(acc.stats.floodWaitUntil) > new Date();
                        const banText = isBanned ? `محظور حتى ${new Date(acc.stats.floodWaitUntil).toLocaleTimeString('ar-EG', {hour: '2-digit', minute: '2-digit'})}` : 'نشط ✅';
                        return (
                        <li key={i} style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <i className="fa-brands fa-telegram" style={{ color: acc.status === 'متصل' ? '#0ea5e9' : 'var(--text-muted)', fontSize: '24px' }}></i>
                                    <div>
                                        <div style={{ direction: 'ltr', fontWeight: 'bold' }}>{acc.phone}</div>
                                        <div style={{ fontSize: '11px', color: acc.status === 'متصل' ? 'var(--success)' : 'var(--text-muted)' }}>
                                            {acc.status} • <span style={{ color: isBanned ? '#ef4444' : '#25D366' }}>{banText}</span>
                                        </div>
                                    </div>
                                </div>
                                <button className="btn btn-icon" style={{ color: '#ef4444' }} onClick={() => handleRemoveAccount(acc.phone)} title="تسجيل الخروج وحذف الحساب">
                                    <i className="fa-solid fa-trash"></i>
                                </button>
                            </div>
                            {acc.stats && (
                                <div style={{ display: 'flex', gap: '15px', fontSize: '12px', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '5px' }}>
                                    <div style={{ color: '#25D366' }}><i className="fa-solid fa-check"></i> تم إضافتهم اليوم: <b>{acc.stats.addedToday || 0}</b></div>
                                    <div style={{ color: '#ef4444' }}><i className="fa-solid fa-xmark"></i> أخطاء اليوم: <b>{acc.stats.failedToday || 0}</b></div>
                                </div>
                            )}
                        </li>
                    )})}
                </ul>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'search' && (
        <section className="glass-panel" style={{ animation: 'fadeIn 0.3s ease' }}>
          <h2 style={{ marginBottom: '20px' }}><i className="fa-solid fa-magnifying-glass" style={{color: '#0ea5e9'}}></i> محرك بحث المجموعات</h2>
          <div className="form-group">
            <label>الكلمة المفتاحية (مثال: برمجة، تسويق، عقارات)</label>
            <input type="text" className="input-modern" placeholder="اكتب هنا..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <button className="btn btn-primary" style={{ marginTop: '15px' }} onClick={handleSearchGroups} disabled={isSearching || !searchQuery}>
              {isSearching ? <><i className="fa-solid fa-spinner fa-spin"></i> جاري البحث عبر تيليجرام...</> : <><i className="fa-solid fa-search"></i> بحث</>}
          </button>

          {searchResults.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                  <h3>تم العثور على {searchResults.length} مجموعة</h3>
                  <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                      <table className="modern-table">
                          <thead>
                              <tr>
                                  <th>اسم المجموعة</th>
                                  <th>الرابط / المعرف</th>
                                  <th>عدد الأعضاء</th>
                                  <th>إجراء</th>
                              </tr>
                          </thead>
                          <tbody>
                              {searchResults.map((g, i) => (
                                  <tr key={i}>
                                      <td style={{ fontWeight: 'bold' }}>
                                        {g.title}
                                        {g.isBroadcast && <span style={{ marginLeft: '10px', fontSize: '10px', background: '#ef4444', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>قناة</span>}
                                        {!g.isBroadcast && <span style={{ marginLeft: '10px', fontSize: '10px', background: '#0ea5e9', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>جروب</span>}
                                      </td>
                                      <td>{g.username ? <a href={g.username} target="_blank" rel="noreferrer" style={{color: '#0ea5e9'}}>{g.username}</a> : 'خاصة'}</td>
                                      <td>
                                        <span style={{ background: 'rgba(37, 211, 102, 0.1)', color: '#25D366', padding: '4px 8px', borderRadius: '12px' }}>
                                            <i className="fa-solid fa-users"></i> {g.participantsCount}
                                        </span>
                                      </td>
                                      <td>
                                          {g.username && !g.isBroadcast ? (
                                              <button className="btn btn-outline" style={{ fontSize: '12px', padding: '5px 10px' }} onClick={() => sendToScraper(g.username, g.title)}>
                                                  <i className="fa-solid fa-spider"></i> إرسال للسحب
                                              </button>
                                          ) : (
                                              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                                {g.isBroadcast ? 'قناة (لا يمكن سحبها)' : 'لا يمكن السحب'}
                                              </span>
                                          )}
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          )}
          {searchResults.length === 0 && hasSearched && !isSearching && (
              <div style={{ marginTop: '20px', padding: '20px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', textAlign: 'center' }}>
                  <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '24px', marginBottom: '10px' }}></i>
                  <p>لم يتم العثور على أي مجموعات لهذه الكلمة!</p>
                  <p style={{ fontSize: '12px', marginTop: '5px' }}>تلميح: محرك بحث تيليجرام لا يدعم الجمل الطويلة. جرب كتابة كلمة واحدة فقط مثل "فحم" أو "عقارات".</p>
              </div>
          )}
        </section>
      )}

      {activeTab === 'scraper' && (
        <section className="glass-panel" style={{ animation: 'fadeIn 0.3s ease' }}>
          <h2 style={{ marginBottom: '20px' }}><i className="fa-solid fa-spider" style={{color: '#0ea5e9'}}></i> سحب الأعضاء من المجموعات</h2>
          <div className="form-group">
            <label>اختر الحساب الذي سيقوم بالسحب:</label>
            <select className="input-modern" value={selectedAccountToScrape} onChange={e => setSelectedAccountToScrape(e.target.value)}>
                <option value="">-- اختر حساب --</option>
                {accounts.map((a,i) => <option key={i} value={a.phone}>{a.phone} ({a.status})</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginTop: '15px' }}>
            <label>رابط المجموعة المصدر (مثال: https://t.me/groupname)</label>
            <input type="text" className="input-modern" placeholder="https://t.me/..." value={sourceGroup} onChange={e => setSourceGroup(e.target.value)} />
          </div>
          <button className="btn btn-primary" style={{ marginTop: '15px' }} onClick={handleScrape} disabled={isScraping || !sourceGroup}>
              {isScraping ? <><i className="fa-solid fa-spinner fa-spin"></i> جاري السحب...</> : <><i className="fa-solid fa-download"></i> بدء سحب الأعضاء</>}
          </button>

          {scrapedMembers.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3>تم العثور على {scrapedMembers.length} عضو</h3>
                    <button className="btn btn-secondary" onClick={handleExportMembers}><i className="fa-solid fa-file-csv"></i> تصدير CSV</button>
                  </div>
                  <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      <table className="modern-table">
                          <thead>
                              <tr>
                                  <th>ID</th>
                                  <th>اسم المستخدم</th>
                                  <th>الاسم الأول</th>
                                  <th>هاتف</th>
                              </tr>
                          </thead>
                          <tbody>
                              {scrapedMembers.slice(0, 50).map((m, i) => (
                                  <tr key={i}>
                                      <td>{m.id}</td>
                                      <td>{m.username ? `@${m.username}` : '-'}</td>
                                      <td>{m.firstName}</td>
                                      <td>{m.phone || '-'}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                      {scrapedMembers.length > 50 && <p style={{textAlign: 'center', padding: '10px', color: 'var(--text-muted)'}}>... و {scrapedMembers.length - 50} آخرين (تم إخفاؤهم لتسريع العرض)</p>}
                  </div>
              </div>
          )}
        </section>
      )}

      {activeTab === 'adder' && (
        <section className="glass-panel" style={{ animation: 'fadeIn 0.3s ease' }}>
          <h2 style={{ marginBottom: '20px' }}><i className="fa-solid fa-user-plus" style={{color: '#0ea5e9'}}></i> إضافة الأعضاء للمجموعات</h2>
          
          <div className="alert-box" style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
              <strong>تحذير هام:</strong> إضافة الأعضاء بسرعة كبيرة أو باستخدام حساب واحد فقط يعرضك للحظر المؤقت أو الدائم. النظام سيقوم بتوزيع الإضافات على الحسابات المسجلة.
          </div>

          <div className="form-group">
            <label>رابط المجموعة الهدف (المراد إضافة الأعضاء إليها)</label>
            <input type="text" className="input-modern" placeholder="https://t.me/..." value={targetGroup} onChange={e => setTargetGroup(e.target.value)} />
          </div>

          <div className="form-group" style={{ marginTop: '15px' }}>
              <label>اختر المجلد المحفوظ (السحبات السابقة):</label>
              <select 
                  className="input-modern" 
                  onChange={(e) => {
                      const folderId = e.target.value;
                      if(folderId) {
                          const folder = savedFolders.find(f => f.id === folderId);
                          if(folder) {
                              fetch(`http://localhost:3000/api/telegram/folders/${folderId}`)
                                  .then(r => r.json())
                                  .then(d => {
                                      if(d.success) {
                                          setScrapedMembers(d.folder.members);
                                          setSelectedFolder(d.folder);
                                      }
                                  });
                          }
                      } else {
                          setSelectedFolder(null);
                          setScrapedMembers([]);
                      }
                  }}
                  value={selectedFolder ? selectedFolder.id : ''}
              >
                  <option value="">-- اختر مجلد --</option>
                  {savedFolders.map(f => (
                      <option key={f.id} value={f.id}>📁 {f.keyword} | {f.channelName} ({f.membersCount} عضو) - {new Date(f.date).toLocaleDateString()}</option>
                  ))}
              </select>
          </div>

          <div className="form-group" style={{ marginTop: '15px' }}>
            <label>التأخير الزمني بين كل عضو والآخر (بالثواني)</label>
            <input type="number" className="input-modern" value={delay} onChange={e => setDelay(e.target.value)} min="10" max="300" />
            <small style={{ color: 'var(--text-muted)' }}>يُفضل استخدام 30-60 ثانية لتجنب الحظر السريع.</small>
          </div>

          <div style={{ marginTop: '15px' }}>
              <strong>الأعضاء الجاهزون للإضافة: </strong> 
              {scrapedMembers.length > 0 ? (
                  <span style={{ color: 'var(--success)' }}>{scrapedMembers.length} عضو {selectedFolder ? `من المجلد (${selectedFolder.keyword})` : 'مباشرة من قسم السحب'}</span>
              ) : (
                  <span style={{ color: '#ef4444' }}>لا يوجد، يرجى اختيار مجلد أو السحب أولاً!</span>
              )}
          </div>

          <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={handleAddMembers} disabled={isAdding || scrapedMembers.length === 0 || !targetGroup || (liveTask && liveTask.status === 'running')}>
              {(liveTask && liveTask.status === 'running') ? <><i className="fa-solid fa-spinner fa-spin"></i> جاري الإضافة...</> : <><i className="fa-solid fa-play"></i> بدء الإضافة التلقائية</>}
          </button>

          {/* Live Dashboard */}
          {liveTask && (
              <div style={{ marginTop: '30px', padding: '20px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <h3 style={{ marginBottom: '15px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span><i className="fa-solid fa-satellite-dish fa-fade" style={{ color: '#0ea5e9' }}></i> التقارير الحية (Live)</span>
                      
                      {liveTask.status === 'running' && <span style={{ fontSize: '14px', color: '#0ea5e9' }}><i className="fa-solid fa-circle fa-beat" style={{ fontSize: '10px', color: '#25D366' }}></i> متصل...</span>}
                      {liveTask.status === 'paused' && <span style={{ fontSize: '14px', color: '#f59e0b' }}><i className="fa-solid fa-pause"></i> متوقف مؤقتاً</span>}
                      {liveTask.status === 'completed' && <span style={{ fontSize: '14px', color: '#25D366' }}><i className="fa-solid fa-check-circle"></i> مكتمل</span>}
                      {liveTask.status === 'error' && <span style={{ fontSize: '14px', color: '#ef4444' }}><i className="fa-solid fa-circle-xmark"></i> خطأ</span>}
                      {liveTask.status === 'cancelled' && <span style={{ fontSize: '14px', color: '#ef4444' }}><i className="fa-solid fa-ban"></i> ملغى</span>}
                  </h3>

                  {/* Task Controls */}
                  {['running', 'paused'].includes(liveTask.status) && (
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px' }}>
                          {liveTask.status === 'running' ? (
                              <button className="btn btn-secondary flex-1" onClick={handlePauseTask}>
                                  <i className="fa-solid fa-pause"></i> إيقاف مؤقت
                              </button>
                          ) : (
                              <button className="btn btn-primary flex-1" style={{ background: '#25D366' }} onClick={handleResumeTask}>
                                  <i className="fa-solid fa-play"></i> استكمال
                              </button>
                          )}
                          <button className="btn btn-danger flex-1" onClick={handleCancelTask}>
                              <i className="fa-solid fa-stop"></i> إنهاء
                          </button>
                      </div>
                  )}
                  
                  {/* Progress Bar */}
                  <div style={{ background: 'rgba(0,0,0,0.3)', height: '10px', borderRadius: '5px', overflow: 'hidden', marginBottom: '20px' }}>
                      <div style={{ width: `${((liveTask.added + liveTask.failed) / liveTask.total) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #0ea5e9, #8b5cf6)', transition: 'width 0.5s ease' }}></div>
                  </div>

                  {/* Stats Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                      <div className="stat-card" style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                          <h4 style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '5px' }}>الإجمالي</h4>
                          <strong style={{ fontSize: '24px', color: '#fff' }}>{liveTask.total}</strong>
                      </div>
                      <div className="stat-card" style={{ background: 'rgba(37, 211, 102, 0.1)', border: '1px solid rgba(37, 211, 102, 0.3)', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                          <h4 style={{ color: '#25D366', fontSize: '12px', marginBottom: '5px' }}>الناجحة</h4>
                          <strong style={{ fontSize: '24px', color: '#25D366' }}>{liveTask.added}</strong>
                      </div>
                      <div className="stat-card" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                          <h4 style={{ color: '#ef4444', fontSize: '12px', marginBottom: '5px' }}>الفاشلة</h4>
                          <strong style={{ fontSize: '24px', color: '#ef4444' }}>{liveTask.failed}</strong>
                      </div>
                      <div className="stat-card" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                          <h4 style={{ color: '#f59e0b', fontSize: '12px', marginBottom: '5px' }}>المتبقية</h4>
                          <strong style={{ fontSize: '24px', color: '#f59e0b' }}>{liveTask.remaining}</strong>
                      </div>
                  </div>

                  {/* Live Console */}
                  <div style={{ background: '#000', borderRadius: '8px', padding: '15px', border: '1px solid #333', fontFamily: 'monospace', fontSize: '13px', color: '#0ea5e9' }}>
                      <div style={{ borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                          <span><i className="fa-solid fa-terminal"></i> Terminal Logs</span>
                          {liveTask.status === 'running' && <span>{Math.ceil((liveTask.remaining * delay) / (accounts.filter(a => a.status === 'متصل').length || 1) / 60)} دقيقة متبقية تقريباً...</span>}
                      </div>
                      <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse' }}>
                          {liveTask.logs && liveTask.logs.map((log, i) => (
                              <div key={i} style={{ marginBottom: '4px', color: log.includes('✅') ? '#25D366' : log.includes('❌') ? '#ef4444' : log.includes('🎉') ? '#8b5cf6' : '#fff' }}>
                                  {log}
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          )}
        </section>
      )}

      {activeTab === 'settings' && (
        <section className="glass-panel" style={{ animation: 'fadeIn 0.3s ease', maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ marginBottom: '20px' }}><i className="fa-solid fa-gear" style={{color: 'var(--primary)'}}></i> إعدادات واجهة تيليجرام (API Keys)</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
            احصل على هذه البيانات مجاناً عن طريق الدخول إلى 
            <a href="https://my.telegram.org" target="_blank" rel="noopener noreferrer" style={{ color: '#0ea5e9', margin: '0 5px', fontWeight: 'bold' }}>my.telegram.org</a>
            واختيار "API development tools".
          </p>

          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label>API ID</label>
            <input type="text" className="input-modern" placeholder="مثال: 1234567" value={apiId} onChange={e => setApiId(e.target.value)} />
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label>API HASH</label>
            <input type="text" className="input-modern" placeholder="مثال: abc123def456..." value={apiHash} onChange={e => setApiHash(e.target.value)} />
          </div>

          <button className="btn btn-primary w-100" onClick={saveSettings}>
            <i className="fa-solid fa-floppy-disk"></i> حفظ الإعدادات
          </button>
          
          {settingsSaved && <p style={{ color: 'var(--success)', marginTop: '10px', textAlign: 'center' }}>تم حفظ الإعدادات بنجاح!</p>}
        </section>
      )}

      {/* Delete Account Modal */}
      {accountToDelete && (
        <div className="modal-overlay" onClick={() => setAccountToDelete(null)}>
          <div className="report-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center', padding: '30px' }}>
            <div style={{ fontSize: '48px', color: '#ef4444', marginBottom: '20px' }}>
              <i className="fa-solid fa-triangle-exclamation fa-fade"></i>
            </div>
            <h3 style={{ marginBottom: '15px' }}>تأكيد الحذف</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '25px', lineHeight: '1.6' }}>
              هل أنت متأكد من رغبتك في حذف الحساب <br/><strong style={{ color: '#fff', fontSize: '18px', display: 'inline-block', marginTop: '10px' }} dir="ltr">{accountToDelete}</strong>؟
            </p>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button className="btn btn-secondary flex-1" onClick={() => setAccountToDelete(null)}>
                إلغاء
              </button>
              <button className="btn btn-primary flex-1" style={{ background: '#ef4444', boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)' }} onClick={confirmRemoveAccount}>
                نعم، احذفه
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Add Members Confirmation */}
      {isAddConfirmOpen && (() => {
          const activeAccountsCount = accounts.filter(a => a.status === 'متصل').length || 1;
          const totalBatches = Math.ceil(scrapedMembers.length / activeAccountsCount);
          const estimatedSeconds = totalBatches * delay;
          const estimatedHours = Math.floor(estimatedSeconds / 3600);
          const estimatedMinutes = Math.floor((estimatedSeconds % 3600) / 60);
          let timeText = '';
          if (estimatedHours > 0) timeText += `${estimatedHours} ساعة `;
          if (estimatedMinutes > 0) timeText += `و ${estimatedMinutes} دقيقة`;
          if (estimatedHours === 0 && estimatedMinutes === 0) timeText = `${estimatedSeconds} ثانية`;

          return (
              <div className="modal-overlay">
                  <div className="modal-content" style={{ maxWidth: '500px', textAlign: 'center' }}>
                      <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '48px', color: '#f59e0b', marginBottom: '15px' }}></i>
                      <h3 style={{ marginBottom: '10px' }}>تأكيد إضافة الأعضاء</h3>
                      <p style={{ color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.6' }}>
                          سيتم محاولة إضافة <strong style={{color: '#fff'}}>{scrapedMembers.length} عضو</strong> بتأخير <strong style={{color: '#fff'}}>{delay} ثانية</strong>.<br/>
                          الجروب الهدف: <strong style={{color: '#0ea5e9'}} dir="ltr">{targetGroup}</strong><br/>
                          <br/>
                          <span style={{ display: 'inline-block', background: 'rgba(14, 165, 233, 0.1)', border: '1px solid #0ea5e9', padding: '10px', borderRadius: '8px', color: '#0ea5e9' }}>
                              <i className="fa-solid fa-clock"></i> <strong>الوقت المتوقع للانتهاء:</strong> {timeText} <br/>
                              <small>(بناءً على استخدام {activeAccountsCount} حساب متصل معاً)</small>
                          </span>
                      </p>
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                          <button className="btn btn-primary" onClick={confirmAddMembers}>
                              <i className="fa-solid fa-check"></i> نعم، ابدأ الإضافة الآن
                          </button>
                          <button className="btn btn-danger" onClick={() => setIsAddConfirmOpen(false)}>
                              إلغاء
                          </button>
                      </div>
                  </div>
              </div>
          );
      })()}

      {activeTab === 'reports' && (
        <section className="glass-panel" style={{ animation: 'fadeIn 0.3s ease' }}>
          <h2 style={{ marginBottom: '20px' }}><i className="fa-solid fa-file-contract" style={{color: '#0ea5e9'}}></i> سجل العمليات والتقارير</h2>
          
          <div className="table-responsive" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table className="modern-table">
                  <thead>
                      <tr>
                          <th>وقت البداية</th>
                          <th>الحالة</th>
                          <th>إجمالي</th>
                          <th>ناجح</th>
                          <th>فاشل</th>
                          <th>متبقي</th>
                          <th>إجراءات</th>
                      </tr>
                  </thead>
                  <tbody>
                      {historyTasks.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>لا توجد عمليات سابقة.</td></tr>}
                      {historyTasks.map((t, i) => (
                          <tr key={i}>
                              <td style={{ direction: 'ltr' }}>{new Date(t.startTime).toLocaleString('ar-EG')}</td>
                              <td>
                                  {t.status === 'completed' ? <span style={{ color: '#25D366' }}>مكتملة</span> :
                                   t.status === 'running' ? <span style={{ color: '#0ea5e9' }}>قيد العمل</span> :
                                   t.status === 'paused' ? <span style={{ color: '#f59e0b' }}>متوقفة مؤقتاً</span> :
                                   t.status === 'error' ? <span style={{ color: '#ef4444' }}>فشلت/توقفت بسبب خطأ</span> :
                                   <span style={{ color: '#ef4444' }}>ملغاة</span>}
                              </td>
                              <td>{t.total}</td>
                              <td style={{ color: '#25D366' }}>{t.added}</td>
                              <td style={{ color: '#ef4444' }}>{t.failed}</td>
                              <td style={{ color: '#f59e0b' }}>{t.remaining}</td>
                              <td>
                                  <button className="btn btn-outline" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => handleExportReport(t)}>
                                      <i className="fa-solid fa-download"></i> تقرير مفصل (CSV)
                                  </button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
        </section>
      )}

    </div>
  );
};

export default TelegramDashboard;
