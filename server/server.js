import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';
import { initClients, sendCode, verifyCode, getAccounts, removeAccount, scrapeGroup, startAddMembersTask, getTaskStatus, getActiveTask, pauseTask, resumeTask, cancelTask, getAllTasks, searchGroups, getSettings, updateSettings, getFolders, getFolderData } from './telegramManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from React frontend build
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Init telegram clients on startup
initClients();

app.post('/api/scrape/web', async (req, res) => {
    const { url, extractEmails, extractPhones, extractSocials } = req.body;
    try {
        // Fetch basic HTML (works only for sites without anti-bot protection)
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = response.data;
        const $ = cheerio.load(html);

        // Extract basic info (Title, Meta description)
        const title = $('title').text() || 'No title';
        const metaDesc = $('meta[name="description"]').attr('content') || 'No description';

        const responseData = [
            { id: 1, field: 'عنوان الصفحة', value: title, confidence: '100%' },
            { id: 2, field: 'الوصف التعريفي', value: metaDesc.substring(0, 100) + '...', confidence: '100%' }
        ];

        let currentId = 3;
        const text = $('body').text();

        // 1. Extract Emails
        if (extractEmails) {
            const emailRegex = /[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}\b/gi;
            let foundEmails = text.match(emailRegex) || [];
            foundEmails = foundEmails.map(e => e.replace(/Tel|KvK|webo/i, ''));
            const uniqueEmails = [...new Set(foundEmails)].filter(e => e.trim().length > 0);
            responseData.push({
                id: currentId++,
                field: 'البريد الإلكتروني',
                value: uniqueEmails.length > 0 ? uniqueEmails.join(' , ') : 'لم يتم العثور',
                confidence: uniqueEmails.length > 0 ? '99%' : '0%'
            });
        }

        // 2. Extract Phones (Smart extraction: look for tel: first, then strict pattern in specific areas)
        if (extractPhones) {
            let foundPhones = [];
            $('a[href^="tel:"]').each((i, el) => {
                const phoneStr = $(el).attr('href').replace('tel:', '').trim();
                // Basic validation: must have numbers
                if (/\d/.test(phoneStr)) {
                    foundPhones.push(phoneStr);
                }
            });
            // Fallback: search only in footer, header, or contact sections to avoid random product IDs
            if (foundPhones.length === 0) {
                const safeText = $('footer, header, .footer, .contact, #footer, #contact, .topbar, .header').text() || '';
                const strictPhoneRegex = /(?:\+|00|0)[1-9][0-9\s-]{7,14}\b/g;
                let matches = safeText.match(strictPhoneRegex) || [];
                // Clean up and filter
                matches = matches.map(p => p.trim()).filter(p => p.replace(/\D/g, '').length >= 9 && p.replace(/\D/g, '').length <= 15);
                foundPhones.push(...matches);
            }
            const uniquePhones = [...new Set(foundPhones)];
            responseData.push({
                id: currentId++,
                field: 'أرقام الهواتف',
                value: uniquePhones.length > 0 ? uniquePhones.slice(0, 3).join(' | ') : 'لم يتم العثور', // limit to top 3 to avoid spam
                confidence: uniquePhones.length > 0 ? '90%' : '0%'
            });
        }

        // 3. Extract Social Media and WhatsApp
        if (extractSocials) {
            // WhatsApp specific
            const whatsappRegex = /(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=|whatsapp\.com\/send\?phone=|whatsapp:\/\/send\?phone=)\+?([0-9]+)/i;
            let foundWhatsapp = [];
            $('a').each((i, el) => {
                const href = $(el).attr('href');
                if (href) {
                    const match = whatsappRegex.exec(href);
                    if (match && match[1]) {
                        foundWhatsapp.push(match[1]);
                    }
                }
            });
            const uniqueWhatsapp = [...new Set(foundWhatsapp)];
            responseData.push({
                id: currentId++,
                field: 'رقم الواتساب',
                value: uniqueWhatsapp.length > 0 ? uniqueWhatsapp.join(' , ') : 'لم يتم العثور',
                confidence: uniqueWhatsapp.length > 0 ? '99%' : '0%'
            });

            // General Socials
            const socialRegex = /(?:https?:\/\/)?(?:www\.)?(?:facebook|twitter|instagram|linkedin|youtube|tiktok|x)\.com\/[a-zA-Z0-9_.-]+\/?/gi;
            let foundSocials = [];
            $('a').each((i, el) => {
                const href = $(el).attr('href');
                if (href && href.match(socialRegex)) {
                    foundSocials.push(href);
                }
            });
            const uniqueSocials = [...new Set(foundSocials)];
            responseData.push({
                id: currentId++,
                field: 'السوشيال ميديا',
                value: uniqueSocials.length > 0 ? uniqueSocials.join(' , ') : 'لم يتم العثور',
                confidence: uniqueSocials.length > 0 ? '95%' : '0%'
            });
        }

        // Add response status
        responseData.push({ id: currentId++, field: 'حالة الاستجابة', value: 'تم قراءة الموقع بنجاح', confidence: '99%' });

        res.json({
            success: true,
            data: responseData
        });
    } catch (error) {
        console.error("Scraping error:", error.message);
        res.status(500).json({ success: false, error: 'تعذر جلب البيانات. قد يكون الموقع محمياً أو الرابط غير صحيح.' });
    }
});

// Google Maps Endpoint (Real API Integration)
app.post('/api/scrape/maps', async (req, res) => {
    const { query, location, mapReviews, mapPhones, mapWebsites, mapAddress } = req.body;

    const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    const searchQuery = `${query} in ${location}`;

    try {
        // Use Places API (New)
        const newPlacesApiUrl = 'https://places.googleapis.com/v1/places:searchText';

        let results = [];
        let nextPageToken = null;
        let pagesFetched = 0;
        const MAX_PAGES = 3; // fetch up to 60 results per query to balance speed and data.

        do {
            const requestBody = {
                textQuery: searchQuery
            };
            
            if (nextPageToken) {
                requestBody.pageToken = nextPageToken;
            }

            const headers = {
                'X-Goog-Api-Key': API_KEY,
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.internationalPhoneNumber,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri,nextPageToken',
                'Content-Type': 'application/json'
            };

            const searchResponse = await axios.post(newPlacesApiUrl, requestBody, { headers });
            
            if (searchResponse.data.places) {
                results = results.concat(searchResponse.data.places);
            }
            
            nextPageToken = searchResponse.data.nextPageToken;
            pagesFetched++;
            
            // New Places API might require a short delay before the token is fully valid
            if (nextPageToken && pagesFetched < MAX_PAGES) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } while (nextPageToken && pagesFetched < MAX_PAGES);

        let responseData = [];
        let currentId = 1;

        for (const place of results) {
            const placeUrl = place.googleMapsUri || `https://maps.google.com/?q=${encodeURIComponent(place.displayName?.text || place.formattedAddress)}`;

            const placeData = {
                id: currentId++,
                title: place.displayName?.text || 'None',
                rating: mapReviews ? (place.rating ? place.rating.toString() : 'None') : undefined,
                reviewsCount: mapReviews ? (place.userRatingCount ? place.userRatingCount.toString() : 'None') : undefined,
                phone: mapPhones ? (place.internationalPhoneNumber || place.nationalPhoneNumber || 'None') : undefined,
                website: mapWebsites ? (place.websiteUri || 'None') : undefined,
                address: mapAddress ? (place.formattedAddress || 'None') : undefined,
                url: placeUrl
            };
            
            // remove undefined fields
            Object.keys(placeData).forEach(key => placeData[key] === undefined && delete placeData[key]);
            
            responseData.push(placeData);
        }

        if (responseData.length === 0) {
             responseData.push({ id: 1, title: 'لم يتم العثور على نتائج في هذه المنطقة', url: '-' });
        }

        res.json({
            success: true,
            data: responseData
        });

    } catch (error) {
        const errorDetail = error.response?.data?.error?.message || error.message;
        console.error("Maps Scraping error:", errorDetail);
        // Extract specific Google error if available
        let errorMsg = 'حدث خطأ أثناء الاتصال بـ Google Maps API. تأكد من تفعيل الـ API Key.';
        if (errorDetail.includes('REQUEST_DENIED') || errorDetail.includes('Billing') || errorDetail.includes('not enabled') || errorDetail.includes('blocked')) {
            errorMsg = `مرفوض من جوجل: ${errorDetail}`;
        }
        res.status(500).json({ success: false, error: errorMsg });
    }
});

app.post('/api/send-email', async (req, res) => {
    const { smtpHost, smtpPort, smtpUser, smtpPass, to, subject, body, isHtml } = req.body;
    
    if (!smtpHost || !smtpUser || !smtpPass || !to || !subject || !body) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    try {
        let transporter = nodemailer.createTransport({
            host: smtpHost,
            port: parseInt(smtpPort) || 465,
            secure: parseInt(smtpPort) === 465, // true for 465, false for other ports
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
        });

        let mailOptions = {
            from: smtpUser,
            to: to,
            subject: subject,
        };

        if (isHtml) {
            mailOptions.html = body;
        } else {
            mailOptions.text = body;
        }

        let info = await transporter.sendMail(mailOptions);

        res.json({ success: true, messageId: info.messageId });
    } catch (error) {
        console.error("Email sending error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- TELEGRAM ROUTES ---
app.post('/api/telegram/send-code', async (req, res) => {
    const { phone } = req.body;
    const result = await sendCode(phone);
    res.json(result);
});

app.post('/api/telegram/verify-code', async (req, res) => {
    const { phone, code } = req.body;
    const result = await verifyCode(phone, code);
    res.json(result);
});

app.get('/api/telegram/accounts', (req, res) => {
    res.json(getAccounts());
});

app.post('/api/telegram/remove-account', async (req, res) => {
    const result = await removeAccount(req.body.phone);
    res.json(result);
});

app.post('/api/telegram/scrape', async (req, res) => {
    const { phone, groupUrl, metadata } = req.body;
    const result = await scrapeGroup(phone, groupUrl, metadata);
    res.json(result);
});

app.post('/api/telegram/add', async (req, res) => {
    const { targetGroupUrl, members, delaySeconds } = req.body;
    if (!targetGroupUrl || !members || !delaySeconds) {
        return res.status(400).json({ success: false, error: 'Missing parameters' });
    }
    const result = await startAddMembersTask(targetGroupUrl, members, delaySeconds);
    res.json(result);
});

app.get('/api/telegram/task/:taskId', (req, res) => {
    const status = getTaskStatus(req.params.taskId);
    if (status) {
        res.json({ success: true, task: status });
    } else {
        res.status(404).json({ success: false, error: 'Task not found' });
    }
});

app.get('/api/telegram/tasks/active', (req, res) => {
    const activeTask = getActiveTask();
    if (activeTask) {
        res.json({ success: true, task: activeTask });
    } else {
        res.json({ success: false });
    }
});

app.get('/api/telegram/tasks/history', (req, res) => {
    res.json(getAllTasks());
});

app.post('/api/telegram/task/:taskId/pause', (req, res) => {
    const success = pauseTask(req.params.taskId);
    res.json({ success });
});

app.post('/api/telegram/task/:taskId/resume', (req, res) => {
    const success = resumeTask(req.params.taskId);
    res.json({ success });
});

app.post('/api/telegram/task/:taskId/cancel', (req, res) => {
    const success = cancelTask(req.params.taskId);
    res.json({ success });
});

app.post('/api/telegram/search-groups', async (req, res) => {
    const { phone, query } = req.body;
    const result = await searchGroups(phone, query);
    res.json(result);
});

app.get('/api/telegram/folders', (req, res) => {
    res.json(getFolders());
});

app.get('/api/telegram/folders/:id', (req, res) => {
    const data = getFolderData(req.params.id);
    if (data) {
        res.json({ success: true, folder: data });
    } else {
        res.json({ success: false, error: 'المجلد غير موجود' });
    }
});

app.get('/api/telegram/settings', (req, res) => {
    res.json(getSettings());
});

app.post('/api/telegram/settings', (req, res) => {
    const { api_id, api_hash } = req.body;
    updateSettings(api_id, api_hash);
    res.json({ success: true });
});

app.post('/api/scrape/directories', async (req, res) => {
    const { keyword, country } = req.body;
    try {
        // [SIMULATION]: Safe generic implementation
        // This is a placeholder structure using example.com.
        // You should replace `targetUrl` and DOM selectors with your target's actual structure.
        
        const targetUrl = `https://example.com/search?q=${encodeURIComponent(keyword)}&loc=${encodeURIComponent(country)}`;
        
        // Simulating a network request delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        /* Uncomment and modify this block for actual target:
        const response = await axios.get(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 ...' }
        });
        const $ = cheerio.load(response.data);
        
        const results = [];
        $('.business-item').each((i, el) => {
            results.push({
                name: $(el).find('.name-selector').text().trim(),
                phone: $(el).find('.phone-selector').text().trim(),
                address: $(el).find('.address-selector').text().trim(),
                website: $(el).find('.website-selector').attr('href')
            });
        });
        */

        // Returning mock data for demonstration purposes
        const results = [
            { name: `شركة ${keyword} الممتازة (${country})`, phone: '+0000000000', address: 'شارع 1، المنطقة التجارية', website: 'https://example.com/1' },
            { name: `مؤسسة رواد ال${keyword}`, phone: '+1111111111', address: 'شارع 2، الحي المالي', website: 'https://example.com/2' },
            { name: `مكتب ${keyword} السريع`, phone: '+2222222222', address: 'المنطقة الصناعية', website: 'N/A' },
            { name: `خدمات ${keyword} المتكاملة`, phone: '+3333333333', address: 'وسط البلد', website: 'https://example.com/4' },
            { name: `الشركة الوطنية لـ ${keyword}`, phone: '+4444444444', address: 'شارع 5', website: 'N/A' }
        ];

        res.json({ success: true, data: results, targetUrl });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'حدث خطأ أثناء الاتصال بالموقع.' });
    }
});

// Fallback for React routing
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
