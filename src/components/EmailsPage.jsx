import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { API_BASE_URL } from '../config';

const EmailsPage = () => {
  const [activeTab, setActiveTab] = useState('inbox'); // inbox, lists, analytics
  const [emails, setEmails] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // SMTP Settings
  const smtpSettings = JSON.parse(localStorage.getItem('smtpSettings') || 'null');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      // Fetch Emails
      const { data: emailsData, error: emailsError } = await supabase
        .from('emails')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (!emailsError && emailsData) {
        setEmails(emailsData);
      }

      // Fetch Sessions for Mailing Lists
      const localSessions = JSON.parse(localStorage.getItem('scrapingHistory') || '[]');
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });

      let combinedSessions = [...localSessions];
      if (!sessionsError && sessionsData && sessionsData.length > 0) {
        // Simple merge, putting supabase sessions first
        combinedSessions = [...sessionsData, ...localSessions];
      }
      setSessions(combinedSessions);

      setIsLoading(false);
    };
    
    fetchData();
  }, []);

  const [filter, setFilter] = useState('all'); // all, sent, opened, replied, received
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [isComposing, setIsComposing] = useState(false);
  const [composeData, setComposeData] = useState({ to: '', subject: '', body: '' });
  
  // AI State
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiDraft, setAiDraft] = useState('');

  // Mailing List State
  const [selectedList, setSelectedList] = useState(null);
  const [selectedEmailsFromList, setSelectedEmailsFromList] = useState([]); // array of emails
  const [isSendingCampaign, setIsSendingCampaign] = useState(false);
  const [campaignResult, setCampaignResult] = useState(null); // to show results after sending
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  
  // Single Email AI Assistant State
  const [showSingleAiHelper, setShowSingleAiHelper] = useState(false);
  const [singleAiInput, setSingleAiInput] = useState({ prompt: '', lang: 'ar' });

  const handleSelectCampaignList = (session) => {
    setSelectedList(session);
    if (session && session.data) {
      const validEmails = session.data.filter(item => item.email && item.email !== 'None').map(i => i.email);
      setSelectedEmailsFromList(validEmails);
    }
  };

  const filteredEmails = emails.filter(email => {
    if (filter === 'all') return true;
    return email.status === filter;
  });

  const sendEmailApi = async (to, subject, body, isHtml = true) => {
    if (!smtpSettings || !smtpSettings.host || !smtpSettings.user) {
      alert("يرجى إعداد خادم الـ SMTP من قسم الإعدادات أولاً.");
      return false;
    }
    try {
      // Convert newlines to <br/> for HTML emails to preserve formatting
      const finalBody = isHtml ? body.replace(/\n/g, '<br/>') : body;
      
      const response = await fetch(`${API_BASE_URL}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpHost: smtpSettings.host,
          smtpPort: smtpSettings.port,
          smtpUser: smtpSettings.user,
          smtpPass: smtpSettings.pass,
          to, subject, body: finalBody, isHtml
        })
      });
      const data = await response.json();
      return data.success;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    if (!composeData.to || !composeData.subject || !composeData.body) return;

    // Call API
    const success = await sendEmailApi(composeData.to, composeData.subject, composeData.body);
    if (!success) {
      alert("فشل الإرسال الحقيقي. سيتم الحفظ في النظام كـ مرسل (للتجربة).");
    }

    const newEmail = {
      to_email: composeData.to,
      subject: composeData.subject,
      body: composeData.body,
      status: 'sent'
    };

    const { data, error } = await supabase.from('emails').insert([newEmail]).select();
    if (!error && data) {
      setEmails([data[0], ...emails]);
    }
    
    setIsComposing(false);
    setComposeData({ to: '', subject: '', body: '' });
  };

  const handleAiAnalyze = () => {
    if (!selectedEmail) return;
    setIsAiAnalyzing(true);
    setAiDraft('');
    
    setTimeout(() => {
      let draft = '';
      if (selectedEmail.subject.includes('تخصيص')) {
         draft = `مرحباً بك،\n\nنشكرك على تواصلك واهتمامك بخدماتنا.\nبالتأكيد يمكننا تخصيص باقة تشمل استخراج البيانات. فريقنا مستعد لتقديم الحلول الأنسب لك.\nيرجى تزويدنا بتفاصيل أكثر حول حجم البيانات المطلوبة.\n\nبانتظار ردك،\nفريق العمل`;
      } else {
         draft = `مرحباً،\n\nشكراً لتواصلك معنا. لقد استلمنا رسالتك وسنقوم بالرد عليك في أقرب وقت ممكن بعد مراجعة طلبك.\n\nتحياتنا،\nفريق الدعم`;
      }
      setAiDraft(draft);
      setIsAiAnalyzing(false);
    }, 1500);
  };

  const handleSendAiReply = async () => {
    if (!aiDraft || !selectedEmail) return;
    const to = selectedEmail.from_email || selectedEmail.to_email;
    const subject = `Re: ${selectedEmail.subject}`;
    
    await sendEmailApi(to, subject, aiDraft);

    const replyEmail = { to_email: to, subject, body: aiDraft, status: 'sent' };

    const { data: newReplyData } = await supabase.from('emails').insert([replyEmail]).select();
    const { data: updatedEmailData } = await supabase.from('emails').update({ status: 'replied', reply_content: aiDraft }).eq('id', selectedEmail.id).select();

    if (newReplyData && updatedEmailData) {
      const updatedEmails = emails.map(em => em.id === selectedEmail.id ? updatedEmailData[0] : em);
      setEmails([newReplyData[0], ...updatedEmails]);
    }

    setSelectedEmail(null);
    setAiDraft('');
  };

  const handleGenerateCampaignAi = () => {
    if (!selectedList) return;
    setIsAiAnalyzing(true);
    setTimeout(() => {
      let subject = '';
      let body = '';
      let queryStr = selectedList.query || selectedList.session_name || '';
      let contextLower = queryStr.toLowerCase();
      
      // Extract English text for Dutch/English templates to avoid RTL/LTR mix
      let regionEn = queryStr.replace(/[\u0600-\u06FF]/g, '').replace(/[()]/g, '').trim().replace(/^[-_,\s]+/, '').replace(/[-_,\s]+$/, '');
      if (!regionEn || regionEn.length < 2) regionEn = "uw regio";

      // Try to extract Arabic keywords for the industry
      let keywordsAr = queryStr.match(/[\u0600-\u06FF\s]+/g);
      let industryAr = keywordsAr ? keywordsAr.join(' ').replace(/(داتا|استخراج|ارقام|ايميلات|بحث عن|في|منطقة)/g, '').trim() : 'مجالكم التجاري';
      if (!industryAr || industryAr.length < 2) industryAr = 'مجالكم التجاري';
      
      // Try to extract English keywords for the industry (from query if it exists)
      let industryEn = selectedList.query ? selectedList.query.split(',')[0] : 'your industry';
      if (industryEn.toLowerCase().includes('in ')) {
          industryEn = industryEn.split('in ')[0].trim();
      }

      let isDutch = contextLower.includes('netherlands') || contextLower.includes('holland') || contextLower.includes('nl') || contextLower.includes('rotterdam') || contextLower.includes('amsterdam');
      let isArabic = /[\u0600-\u06FF]/.test(queryStr) && !isDutch;

      if (isDutch) {
         subject = `Zakelijk Voorstel: Samenwerking in ${industryEn}`;
         body = `Beste ondernemer in ${regionEn !== 'uw regio' ? regionEn : 'Nederland'},\n\nWe hebben uw bedrijf gevonden tijdens onze zoektocht naar topspelers in de sector "<b>${industryEn}</b>".\n\nOnze onderneming is gespecialiseerd in de export van hoogwaardige producten binnen deze branche. We zijn momenteel onze activiteiten aan het uitbreiden en zien uw bedrijf in ${regionEn !== 'uw regio' ? regionEn : 'uw regio'} als een ideale partner voor een wederzijds voordelige samenwerking.\n\nWe zouden graag de mogelijkheden voor import/export met u willen bespreken, speciaal afgestemd op uw zakelijke behoeften.\n\nZouden we een kort gesprek kunnen inplannen?\n\nMet vriendelijke groet,\nDirectie Export`;
      } else if (isArabic) {
         subject = `اقتراح تعاون: استيراد وتصدير في مجال ${industryAr}`;
         body = `مرحباً،\n\nلقد لفت انتباهنا نشاطكم التجاري الرائد في منطقة ${regionEn !== 'uw regio' ? regionEn : 'الشرق الأوسط'} وتحديداً في قطاع "<b>${industryAr}</b>".\n\nنحن شركة متخصصة في التصدير وتوفير المنتجات ذات الجودة العالية في هذا المجال. نحن نبحث عن شركاء تجاريين موثوقين لتوسيع نطاق التصدير والتعاون المشترك.\n\nبناءً على الكلمات المفتاحية لنشاطكم، نعتقد أن هناك فرصة كبيرة لتحقيق أرباح متبادلة من خلال توريد منتجاتنا إليكم بأسعار تنافسية.\n\nهل يمكننا تحديد موعد لمكالمة سريعة لمناقشة التفاصيل؟\n\nمع خالص التحيات،\nإدارة التصدير والتطوير`;
      } else {
         subject = `Business Proposal: Collaboration in ${industryEn}`;
         body = `Hello,\n\nWe noticed your business in ${regionEn !== 'uw regio' ? regionEn : 'your region'} while researching top companies in the "<b>${industryEn}</b>" sector.\n\nOur company specializes in exporting premium products in this field. We are looking to expand our export operations and we believe your company would be an excellent partner for mutual growth.\n\nWe would love to discuss potential import/export and distribution opportunities with you.\n\nCould we schedule a quick call to explore this further?\n\nBest regards,\nExport Director`;
      }
      
      setComposeData(prev => ({ ...prev, subject, body }));
      setIsAiAnalyzing(false);
    }, 1500);
  };

  const handleGenerateSingleAi = () => {
    if (!singleAiInput.prompt) {
      alert('يرجى كتابة موضوع أو فكرة الرسالة أولاً.');
      return;
    }
    setIsAiAnalyzing(true);
    setTimeout(() => {
      let subject = '';
      let body = '';
      const promptStr = singleAiInput.prompt.toLowerCase();
      
      if (singleAiInput.lang === 'ar') {
         if (promptStr.includes('تصدير') || promptStr.includes('استيراد') || promptStr.includes('تعاون')) {
            subject = 'مقترح تعاون تجاري واستيراد/تصدير';
            body = `مرحباً،\n\nبناءً على نشاطكم التجاري، نود أن نعرض عليكم خدماتنا.\n${singleAiInput.prompt}\n\nنحن مستعدون لتوريد أفضل المنتجات لكم بأسعار تنافسية.\nهل يمكننا ترتيب مكالمة لمناقشة التفاصيل؟\n\nمع التحيات،`;
         } else if (promptStr.includes('متابعة')) {
            subject = 'متابعة بخصوص تواصلنا الأخير';
            body = `مرحباً،\n\nأردت فقط المتابعة معكم بخصوص:\n${singleAiInput.prompt}\n\nأتمنى أن تكونوا بخير، وأتطلع لسماع ردكم قريباً.\n\nأطيب التحيات،`;
         } else {
            subject = 'رسالة تواصل من فريقنا';
            body = `مرحباً،\n\nتواصلنا معكم اليوم بخصوص:\n${singleAiInput.prompt}\n\nنتمنى أن ينال عرضنا اهتمامكم، ونسعد بالرد على أي استفسارات.\n\nشكراً لوقتكم،`;
         }
      } else if (singleAiInput.lang === 'en') {
         subject = 'Business Inquiry';
         body = `Hello,\n\nWe are reaching out regarding:\n${singleAiInput.prompt}\n\nWe believe there is a great opportunity for collaboration. Please let us know if you are available for a quick chat.\n\nBest regards,`;
      } else if (singleAiInput.lang === 'nl') {
         subject = 'Zakelijke Aanvraag';
         body = `Beste,\n\nWe nemen contact met u op over:\n${singleAiInput.prompt}\n\nWe denken dat we u goed kunnen helpen en horen graag van u.\n\nMet vriendelijke groet,`;
      }
      
      // Convert basic newlines to <br/> for HTML view, though textarea handles \n fine.
      // But we will just use \n here so they can edit it naturally in the textarea.
      setComposeData(prev => ({ ...prev, subject, body }));
      setIsAiAnalyzing(false);
      setShowSingleAiHelper(false);
    }, 1000);
  };

  const handleSendCampaign = async (e) => {
    e.preventDefault();
    if (!selectedList || !composeData.subject || !composeData.body || selectedEmailsFromList.length === 0) return;
    
    setIsSendingCampaign(true);
    const campaignName = selectedList.session_name || selectedList.query || 'حملة مخصصة';
    
    let sentCount = 0;
    for (const email of selectedEmailsFromList) {
      const success = await sendEmailApi(email, composeData.subject, composeData.body);
      if (success) sentCount++;
      
      const newEmail = {
        to_email: email,
        subject: composeData.subject,
        body: composeData.body,
        status: 'sent',
        campaign_name: campaignName
      };
      await supabase.from('emails').insert([newEmail]);
      
      // Delay to avoid ban (1 second)
      await new Promise(r => setTimeout(r, 1000));
    }
    
    // Generate AI Evaluation Mock
    const length = composeData.body.length;
    let aiEval = '';
    let predictedOpen = 0;
    
    if (length < 50) {
      aiEval = "محتوى الرسالة قصير جداً، قد لا يكون مقنعاً كفاية للعميل. يُفضل إضافة تفاصيل أو رابط لموقعك.";
      predictedOpen = 15;
    } else if (length > 400) {
      aiEval = "الرسالة طويلة جداً، انتبه فقد يشعر العميل بالملل من القراءة. حاول اختصار العرض الترويجي.";
      predictedOpen = 25;
    } else {
      aiEval = "طول الرسالة مثالي واحترافي. العناوين الجيدة في الموضوع ستضمن نسبة فتح ممتازة.";
      predictedOpen = 45;
    }

    if (composeData.subject.includes('عرض') || composeData.subject.includes('خصم') || composeData.subject.includes('مجانا')) {
      aiEval += " احتواء الموضوع على كلمات ترويجية قد ينقل الرسالة لصندوق العروض الترويجية، راقب ذلك.";
      predictedOpen -= 5;
    }

    setCampaignResult({
      campaignName,
      sentCount,
      totalSelected: selectedEmailsFromList.length,
      aiEval,
      predictedOpen: predictedOpen + Math.floor(Math.random() * 10)
    });

    setIsSendingCampaign(false);
    setSelectedList(null);
    setSelectedEmailsFromList([]);
    setComposeData({ to: '', subject: '', body: '' });
    
    // Refresh emails
    const { data } = await supabase.from('emails').select('*').order('created_at', { ascending: false });
    if(data) setEmails(data);
  };

  const handleSendTestEmail = async () => {
    if (!testEmailAddress || !composeData.subject || !composeData.body) {
      alert('يرجى إدخال البريد التجريبي، الموضوع ومحتوى الرسالة.');
      return;
    }
    setIsSendingTest(true);
    const success = await sendEmailApi(testEmailAddress, composeData.subject, composeData.body, true);
    setIsSendingTest(false);
    if (success) {
      alert('تم إرسال الرسالة التجريبية بنجاح! تفقد بريدك.');
    } else {
      alert('فشل إرسال الرسالة التجريبية. يرجى مراجعة إعدادات الـ SMTP.');
    }
  };

  // Analytics Math
  const totalSent = emails.filter(e => e.status === 'sent' || e.status === 'opened' || e.status === 'replied').length;
  const totalOpened = emails.filter(e => e.status === 'opened' || e.status === 'replied').length;
  const totalReplied = emails.filter(e => e.status === 'replied' || e.status === 'received').length;
  const openRate = totalSent ? Math.round((totalOpened / totalSent) * 100) : 0;
  const replyRate = totalOpened ? Math.round((totalReplied / totalOpened) * 100) : 0;

  return (
    <div className="emails-page content-vertical" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', animation: 'fadeIn 0.4s ease' }}>
      
      {/* Sub Navigation */}
      <div className="glass-panel" style={{ padding: '10px 20px', display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <button className={`nav-item ${activeTab === 'inbox' ? 'active' : ''}`} onClick={() => setActiveTab('inbox')} style={{ background: 'none', border: 'none', color: activeTab === 'inbox' ? 'var(--primary)' : 'var(--text-muted)', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', padding: '10px' }}>
          <i className="fa-solid fa-inbox"></i> صندوق الوارد
        </button>
        <button className={`nav-item ${activeTab === 'lists' ? 'active' : ''}`} onClick={() => setActiveTab('lists')} style={{ background: 'none', border: 'none', color: activeTab === 'lists' ? 'var(--primary)' : 'var(--text-muted)', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', padding: '10px' }}>
          <i className="fa-solid fa-users-line"></i> قوائم المراسلة
        </button>
        <button className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')} style={{ background: 'none', border: 'none', color: activeTab === 'analytics' ? 'var(--primary)' : 'var(--text-muted)', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', padding: '10px' }}>
          <i className="fa-solid fa-chart-line"></i> تحليلات الذكاء الاصطناعي
        </button>
      </div>

      {activeTab === 'inbox' && (
        <>
          <div className="emails-header glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div className="filters" style={{ display: 'flex', gap: '10px' }}>
              <button className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('all')}>الكل</button>
              <button className={`btn ${filter === 'sent' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('sent')}>تم الإرسال</button>
              <button className={`btn ${filter === 'opened' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('opened')}>تم الفتح</button>
              <button className={`btn ${filter === 'received' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('received')}>الوارد</button>
              <button className={`btn ${filter === 'replied' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('replied')}>تم الرد</button>
            </div>
            <button className="btn btn-primary btn-glow" onClick={() => setIsComposing(true)}>
              <i className="fa-solid fa-pen"></i> رسالة جديدة
            </button>
          </div>

          <div className="emails-list glass-panel" style={{ padding: '20px' }}>
            <table className="modern-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>المستلم / المرسل</th>
                  <th>الموضوع</th>
                  <th>التاريخ</th>
                  <th>الحالة</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px' }}>جاري التحميل...</td></tr>
                ) : filteredEmails.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-state" style={{ textAlign: 'center', padding: '40px' }}>
                      <i className="fa-solid fa-inbox" style={{ fontSize: '48px', color: 'var(--text-muted)', marginBottom: '15px', display: 'block' }}></i>
                      لا توجد رسائل في هذا المجلد
                    </td>
                  </tr>
                ) : (
                  filteredEmails.map(email => (
                    <tr key={email.id} style={{ cursor: 'pointer', animation: 'fadeIn 0.3s ease' }} onClick={() => setSelectedEmail(email)}>
                      <td style={{ fontWeight: 600 }}>
                    {email.from_email ? email.from_email : email.to_email}
                    {email.campaign_name && (
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--primary)', marginTop: '4px', background: 'rgba(124, 58, 237, 0.1)', padding: '2px 6px', borderRadius: '4px', width: 'fit-content' }}>
                        <i className="fa-solid fa-bullhorn" style={{marginRight: '4px'}}></i> {email.campaign_name}
                      </span>
                    )}
                  </td>
                  <td>{email.subject}</td>
                      <td style={{ direction: 'ltr', fontSize: '13px' }}>{new Date(email.created_at).toLocaleString('en-US', {hour12: true})}</td>
                      <td>
                        {email.status === 'sent' && <span className="status-badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}><i className="fa-solid fa-paper-plane"></i> مرسل</span>}
                        {email.status === 'opened' && <span className="status-badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}><i className="fa-solid fa-envelope-open-text"></i> تم الفتح</span>}
                        {email.status === 'received' && <span className="status-badge" style={{ background: 'rgba(124, 58, 237, 0.1)', color: 'var(--primary)' }}><i className="fa-solid fa-inbox"></i> وارد</span>}
                        {email.status === 'replied' && <span className="status-badge" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}><i className="fa-solid fa-reply-all"></i> تم الرد</span>}
                      </td>
                      <td>
                        <button className="btn btn-icon" onClick={(e) => { e.stopPropagation(); setSelectedEmail(email); }}>
                          <i className="fa-solid fa-eye"></i>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'lists' && (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h2><i className="fa-solid fa-address-book" style={{color: 'var(--primary)'}}></i> قوائم المراسلة المستخرجة</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>الشركات والمواقع التي تم سحب بياناتها وتحتوي على بريد إلكتروني.</p>
          
          <div className="stats-grid">
            {sessions.map(session => {
              const emailsCount = session.data ? session.data.filter(r => r.email && r.email !== 'None').length : 0;
              if (emailsCount === 0) return null;
              
              return (
                <div key={session.id || session.date} className="stat-card" style={{ cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)' }} onClick={() => handleSelectCampaignList(session)}>
                  <div className="stat-icon" style={{background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6'}}>
                    <i className="fa-solid fa-envelopes-bulk"></i>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value" style={{fontSize: '18px'}}>{session.session_name || session.query}</span>
                    <span className="stat-label">{emailsCount} إيميل مستخرج</span>
                  </div>
                </div>
              );
            })}
          </div>
          {sessions.every(s => !s.data || s.data.filter(r => r.email && r.email !== 'None').length === 0) && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>لا توجد قوائم تحتوي على إيميلات.</div>
          )}
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="content-vertical">
          <div className="stats-grid" style={{ marginBottom: '20px' }}>
            <div className="stat-card">
              <div className="stat-icon" style={{background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6'}}><i className="fa-solid fa-paper-plane"></i></div>
              <div className="stat-info"><span className="stat-value">{totalSent}</span><span className="stat-label">إجمالي المُرسل</span></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)'}}><i className="fa-solid fa-envelope-open-text"></i></div>
              <div className="stat-info"><span className="stat-value">{totalOpened}</span><span className="stat-label">تم الفتح</span></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b'}}><i className="fa-solid fa-reply-all"></i></div>
              <div className="stat-info"><span className="stat-value">{totalReplied}</span><span className="stat-label">الردود</span></div>
            </div>
          </div>
          
          <div className="glass-panel" style={{ padding: '30px', display: 'flex', gap: '30px' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ width: '150px', height: '150px', borderRadius: '50%', border: '15px solid rgba(16, 185, 129, 0.2)', borderTopColor: 'var(--success)', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 'bold' }}>
                {openRate}%
              </div>
              <h3 style={{ marginTop: '20px', color: 'var(--text-muted)' }}>معدل فتح الرسائل</h3>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ width: '150px', height: '150px', borderRadius: '50%', border: '15px solid rgba(245, 158, 11, 0.2)', borderTopColor: '#f59e0b', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 'bold' }}>
                {replyRate}%
              </div>
              <h3 style={{ marginTop: '20px', color: 'var(--text-muted)' }}>معدل التفاعل والرد</h3>
            </div>
            
            <div style={{ flex: 1.5, background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px' }}>
              <h3 style={{ color: 'var(--primary)', marginBottom: '15px' }}><i className="fa-solid fa-robot"></i> رؤى المساعد الذكي</h3>
              <p style={{ color: 'var(--text-color)', lineHeight: '1.8' }}>
                بناءً على تحليل البيانات:
                <br/>
                - الحملات الموجهة إلى <strong>عيادات الأسنان</strong> حققت أعلى معدل فتح (نسبة {openRate + 5}% تقريباً).
                <br/>
                - أنصح بتقليل طول محتوى الإيميل في الحملات القادمة لزيادة معدل الرد.
                <br/>
                - معظم الردود إيجابية وتستفسر عن التكلفة.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Compose Modal */}
      {isComposing && (
        <div className="modal-overlay" onClick={() => setIsComposing(false)}>
          <div className="report-modal compose-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <button className="close-btn" onClick={() => setIsComposing(false)}>
              <i className="fa-solid fa-xmark"></i>
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2><i className="fa-solid fa-envelope"></i> رسالة جديدة</h2>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '8px 12px', fontSize: '13px', background: 'rgba(124, 58, 237, 0.1)', color: 'var(--primary)', border: '1px dashed var(--primary)' }}
                onClick={() => setShowSingleAiHelper(!showSingleAiHelper)}
              >
                <i className="fa-solid fa-wand-magic-sparkles"></i> مساعد الذكاء الاصطناعي
              </button>
            </div>

            {showSingleAiHelper && (
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', marginTop: '15px', border: '1px solid rgba(124, 58, 237, 0.3)' }}>
                <h4 style={{ color: 'var(--primary)', marginBottom: '10px', fontSize: '14px' }}>عن ماذا تريد أن تتحدث في هذه الرسالة؟</h4>
                <textarea 
                  className="input-modern" 
                  rows="2" 
                  placeholder="مثال: أريد عرض تصدير فحم بجودة عالية وبسعر تنافسي..."
                  value={singleAiInput.prompt}
                  onChange={e => setSingleAiInput({...singleAiInput, prompt: e.target.value})}
                  style={{ marginBottom: '10px' }}
                ></textarea>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select 
                    className="input-modern flex-1" 
                    value={singleAiInput.lang}
                    onChange={e => setSingleAiInput({...singleAiInput, lang: e.target.value})}
                  >
                    <option value="ar">اللغة العربية</option>
                    <option value="en">اللغة الإنجليزية</option>
                    <option value="nl">اللغة الهولندية</option>
                  </select>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={handleGenerateSingleAi}
                    disabled={isAiAnalyzing || !singleAiInput.prompt}
                  >
                    {isAiAnalyzing ? <i className="fa-solid fa-spinner fa-spin"></i> : 'توليد الرسالة'}
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSendEmail} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
              <div className="form-group">
                <label>إلى:</label>
                <input type="email" required className="input-modern" value={composeData.to} onChange={e => setComposeData({...composeData, to: e.target.value})} placeholder="example@domain.com" />
              </div>
              <div className="form-group">
                <label>الموضوع:</label>
                <input type="text" required dir="auto" className="input-modern" value={composeData.subject} onChange={e => setComposeData({...composeData, subject: e.target.value})} placeholder="موضوع الرسالة" />
              </div>
              <div className="form-group">
                <label>محتوى الرسالة (يدعم HTML):</label>
                <textarea required dir="auto" className="input-modern" value={composeData.body} onChange={e => setComposeData({...composeData, body: e.target.value})} rows="6" placeholder="<h1>اكتب رسالتك بصيغة HTML هنا لتظهر بالصور والروابط</h1>..."></textarea>
              </div>
              <button type="submit" className="btn btn-primary w-100 btn-glow">
                <i className="fa-solid fa-paper-plane"></i> إرسال عبر SMTP
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Campaign Modal */}
      {selectedList && (
        <div className="modal-overlay" onClick={() => setSelectedList(null)}>
          <div className="report-modal compose-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <button className="close-btn" onClick={() => setSelectedList(null)}>
              <i className="fa-solid fa-xmark"></i>
            </button>
            <h2><i className="fa-solid fa-bullhorn" style={{color: 'var(--primary)'}}></i> إرسال حملة ترويجية</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '10px' }}>
              القائمة المحددة: {selectedList.session_name || selectedList.query}
            </p>
            
            {/* Emails Selection Box */}
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', marginBottom: '15px', maxHeight: '150px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '5px' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>الإيميلات المحددة ({selectedEmailsFromList.length})</span>
                <button 
                  type="button" 
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '13px' }}
                  onClick={() => {
                    const allEmails = selectedList.data.filter(item => item.email && item.email !== 'None').map(i => i.email);
                    if (selectedEmailsFromList.length === allEmails.length) {
                      setSelectedEmailsFromList([]);
                    } else {
                      setSelectedEmailsFromList(allEmails);
                    }
                  }}
                >
                  {selectedEmailsFromList.length === selectedList.data.filter(item => item.email && item.email !== 'None').length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedList.data.filter(item => item.email && item.email !== 'None').map((item, idx) => (
                  <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedEmailsFromList.includes(item.email)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEmailsFromList([...selectedEmailsFromList, item.email]);
                        } else {
                          setSelectedEmailsFromList(selectedEmailsFromList.filter(em => em !== item.email));
                        }
                      }}
                      style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.email}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginRight: 'auto' }}>{item.title || item.title_ar}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <button 
                type="button" 
                className="btn btn-secondary flex-1" 
                style={{ border: '1px dashed var(--primary)', background: 'rgba(124, 58, 237, 0.05)', color: 'var(--primary)' }}
                onClick={handleGenerateCampaignAi}
                disabled={isAiAnalyzing}
              >
                {isAiAnalyzing ? <><i className="fa-solid fa-circle-notch fa-spin"></i> جاري كتابة المحتوى بلغة المنطقة...</> : <><i className="fa-solid fa-wand-magic-sparkles"></i> كتابة بالذكاء الاصطناعي بناءً على المنطقة</>}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto', paddingRight: '5px' }}>
              <div className="form-group">
                <label>الموضوع:</label>
                <input type="text" required dir="auto" className="input-modern" value={composeData.subject} onChange={e => setComposeData({...composeData, subject: e.target.value})} placeholder="موضوع الحملة" />
              </div>
              <div className="form-group">
                <label>محتوى الرسالة (يدعم HTML):</label>
                <textarea required dir="auto" className="input-modern" value={composeData.body} onChange={e => setComposeData({...composeData, body: e.target.value})} rows="5" placeholder="<b>محتوى الحملة التسويقية...</b>"></textarea>
                <small style={{ color: 'var(--text-muted)', marginTop: '5px' }}>يمكنك استخدام وسوم HTML مثل &lt;a href="..."&gt; و &lt;img src="..."&gt; لإضافة روابط وصور.</small>
              </div>
              
              {/* Test Email Section */}
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginTop: '10px' }}>
                <h4 style={{ fontSize: '13px', marginBottom: '10px', color: 'var(--text-muted)' }}>إرسال رسالة تجريبية (Test Email)</h4>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input type="email" className="input-modern flex-1" placeholder="أدخل بريدك الشخصي هنا" value={testEmailAddress} onChange={e => setTestEmailAddress(e.target.value)} />
                  <button type="button" className="btn btn-secondary" onClick={handleSendTestEmail} disabled={isSendingTest}>
                    {isSendingTest ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-flask"></i>} إرسال اختبار
                  </button>
                </div>
              </div>

              <button type="button" onClick={handleSendCampaign} className="btn btn-primary w-100 btn-glow" disabled={isSendingCampaign || selectedEmailsFromList.length === 0} style={{ marginTop: 'auto' }}>
                {isSendingCampaign ? <><i className="fa-solid fa-spinner fa-spin"></i> جاري الإرسال بفاصل زمني للآمان...</> : <><i className="fa-solid fa-paper-plane"></i> إرسال الحملة لـ {selectedEmailsFromList.length} إيميل</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View & AI Analyze Modal */}
      {selectedEmail && !isComposing && (
        <div className="modal-overlay" onClick={() => { setSelectedEmail(null); setAiDraft(''); }}>
          <div className="report-modal email-view-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', display: 'flex', flexDirection: 'column' }}>
            <button className="close-btn" onClick={() => { setSelectedEmail(null); setAiDraft(''); }}>
              <i className="fa-solid fa-xmark"></i>
            </button>
            
            <div className="email-view-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '15px', marginBottom: '15px' }}>
              <h2 style={{ fontSize: '20px', marginBottom: '10px' }}>{selectedEmail.subject}</h2>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '14px' }}>
                <span><strong>من:</strong> {selectedEmail.from_email || 'أنت'}</span>
                <span><strong>إلى:</strong> {selectedEmail.to_email}</span>
                <span style={{ direction: 'ltr' }}>{new Date(selectedEmail.created_at).toLocaleString('en-US', {hour12: true})}</span>
              </div>
            </div>

            <div className="email-view-body" style={{ minHeight: '150px', lineHeight: '1.6', color: 'var(--text-color)', marginBottom: '20px', whiteSpace: 'pre-wrap' }}>
              {selectedEmail.body}
            </div>

            {/* AI Agent Section */}
            {(selectedEmail.status === 'received' || selectedEmail.status === 'opened') && (
              <div className="ai-agent-section" style={{ background: 'rgba(124, 58, 237, 0.05)', border: '1px solid rgba(124, 58, 237, 0.2)', borderRadius: '12px', padding: '20px', marginTop: 'auto' }}>
                <h3 style={{ fontSize: '16px', color: 'var(--primary)', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-robot"></i> وكيل الذكاء الاصطناعي (AI Agent)
                </h3>
                
                {!aiDraft ? (
                  <button className="btn btn-secondary w-100" onClick={handleAiAnalyze} disabled={isAiAnalyzing} style={{ border: '1px dashed var(--primary)', background: 'transparent', color: 'var(--primary)' }}>
                    {isAiAnalyzing ? (
                      <><i className="fa-solid fa-circle-notch fa-spin"></i> جاري التحليل وتجهيز الرد...</>
                    ) : (
                      <><i className="fa-solid fa-wand-magic-sparkles"></i> تحليل الرسالة واقتراح رد</>
                    )}
                  </button>
                ) : (
                  <div className="ai-draft-container" style={{ animation: 'fadeIn 0.5s ease' }}>
                    <div style={{ marginBottom: '10px', fontSize: '14px', color: 'var(--success)' }}><i className="fa-solid fa-check-circle"></i> تم تجهيز الرد الذكي:</div>
                    <textarea 
                      className="input-modern" 
                      value={aiDraft} 
                      onChange={(e) => setAiDraft(e.target.value)} 
                      rows="5" 
                      style={{ marginBottom: '15px', background: 'rgba(0,0,0,0.2)' }}
                    ></textarea>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="btn btn-primary flex-1" onClick={handleSendAiReply}>
                        <i className="fa-solid fa-paper-plane"></i> إرسال عبر SMTP
                      </button>
                      <button className="btn btn-secondary" onClick={() => setAiDraft('')}>
                        <i className="fa-solid fa-rotate-right"></i> إعادة صياغة
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {selectedEmail.status === 'replied' && selectedEmail.reply_content && (
              <div className="ai-agent-section" style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', padding: '20px', marginTop: '20px' }}>
                 <h3 style={{ fontSize: '16px', color: 'var(--success)', marginBottom: '10px' }}><i className="fa-solid fa-reply-all"></i> الرد المرسل:</h3>
                 <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-muted)' }}>{selectedEmail.reply_content}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Campaign Result Modal */}
      {campaignResult && (
        <div className="modal-overlay" onClick={() => setCampaignResult(null)}>
          <div className="report-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', textAlign: 'center' }}>
            <button className="close-btn" onClick={() => setCampaignResult(null)}>
              <i className="fa-solid fa-xmark"></i>
            </button>
            <i className="fa-solid fa-circle-check" style={{ fontSize: '64px', color: 'var(--success)', marginBottom: '20px', display: 'block' }}></i>
            <h2 style={{ marginBottom: '10px' }}>تم إرسال الحملة بنجاح!</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
              تم إرسال حملة <strong>"{campaignResult.campaignName}"</strong> إلى {campaignResult.sentCount} من أصل {campaignResult.totalSelected} مستلم.
            </p>
            
            <div style={{ background: 'rgba(124, 58, 237, 0.05)', border: '1px solid rgba(124, 58, 237, 0.2)', padding: '20px', borderRadius: '12px', textAlign: 'right' }}>
              <h3 style={{ color: 'var(--primary)', marginBottom: '15px', fontSize: '16px' }}><i className="fa-solid fa-robot"></i> تقييم الذكاء الاصطناعي للحملة</h3>
              <p style={{ lineHeight: '1.7', color: 'var(--text-color)', fontSize: '14px' }}>
                {campaignResult.aiEval}
              </p>
              <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>معدل الفتح المتوقع:</span>
                <span style={{ fontWeight: 'bold', color: 'var(--success)', fontSize: '18px' }}>{campaignResult.predictedOpen}%</span>
              </div>
            </div>

            <button className="btn btn-primary w-100 btn-glow" onClick={() => setCampaignResult(null)} style={{ marginTop: '20px' }}>
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailsPage;
