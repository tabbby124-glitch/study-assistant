const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// مفاتيح API
const GEMINI_KEY = "AIzaSyAtCfwHZjjVYHdNtkrCjF8dxxeasnjCC6o";
const DEEPSEEK_KEY = "sk-362ef439347945b3a0745de461f832fb";

// ==================== Health Check ====================
app.get('/api/health', (req, res) => {
  res.json({ status: "ok", message: "Backend is running with Gemini & DeepSeek!" });
});

// ==================== Translate Endpoint ====================
app.post('/api/translate', async (req, res) => {
  try {
    const { text, type = 'translate', userId = 'guest' } = req.body;
    
    if (!text) {
      return res.status(400).json({ success: false, error: "Text is required" });
    }
    
    // بناء النص حسب النوع
    let prompt = text;
    if (type === 'summarize') {
      prompt = `لخص النص التالي واستخرج النقاط الرئيسية بالعربية:\n\n${text}`;
    } else if (type === 'sudanese') {
      prompt = `اشرح النص التالي باللهجة السودانية العامية (استخدم كلمات زي: يا زول، شد حيلك، الحنك):\n\n${text}`;
    } else if (type === 'terms') {
      prompt = `استخرج المصطلحات التقنية المهمة من النص وترجمتها للعربية. أخرج بصيغة JSON: [{"term":"...","translation":"..."}]\n\n${text}`;
    } else {
      prompt = `ترجم النص التالي إلى اللغة العربية الفصحى بدقة عالية، مع شرح المصطلحات التقنية:\n\n${text}`;
    }
    
    // 1. جرب Gemini أولاً
    try {
      const geminiResponse = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2000 }
        },
        { timeout: 30000 }
      );
      
      const result = geminiResponse.data.candidates[0].content.parts[0].text;
      console.log(`✅ Gemini success for ${userId}`);
      
      return res.json({
        success: true,
        result: result,
        tool: "Gemini"
      });
    } catch (geminiError) {
      console.log(`❌ Gemini failed: ${geminiError.message}`);
    }
    
    // 2. جرب DeepSeek
    try {
      const deepseekResponse = await axios.post(
        "https://api.deepseek.com/v1/chat/completions",
        {
          model: "deepseek-chat",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 2000
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_KEY}`
          },
          timeout: 30000
        }
      );
      
      const result = deepseekResponse.data.choices[0].message.content;
      console.log(`✅ DeepSeek success for ${userId}`);
      
      return res.json({
        success: true,
        result: result,
        tool: "DeepSeek"
      });
    } catch (deepseekError) {
      console.log(`❌ DeepSeek failed: ${deepseekError.message}`);
    }
    
    // 3. فشل الكل
    return res.json({
      success: false,
      error: "Both APIs failed"
    });
    
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Chat Endpoint ====================
app.post('/api/chat', async (req, res) => {
  try {
    const { question, context, userId = 'guest' } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }
    
    const prompt = `السؤال: ${question}\n\nالمحتوى: ${context || ''}\n\nأجب على السؤال بالعربية بناءً على المحتوى فقط.`;
    
    // 1. جرب Gemini
    try {
      const geminiResponse = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2000 }
        },
        { timeout: 30000 }
      );
      
      const answer = geminiResponse.data.candidates[0].content.parts[0].text;
      console.log(`✅ Chat via Gemini for ${userId}`);
      
      return res.json({
        answer: answer,
        tool: "Gemini"
      });
    } catch (geminiError) {
      console.log(`❌ Gemini chat failed: ${geminiError.message}`);
    }
    
    // 2. جرب DeepSeek
    try {
      const deepseekResponse = await axios.post(
        "https://api.deepseek.com/v1/chat/completions",
        {
          model: "deepseek-chat",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 2000
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_KEY}`
          },
          timeout: 30000
        }
      );
      
      const answer = deepseekResponse.data.choices[0].message.content;
      console.log(`✅ Chat via DeepSeek for ${userId}`);
      
      return res.json({
        answer: answer,
        tool: "DeepSeek"
      });
    } catch (deepseekError) {
      console.log(`❌ DeepSeek chat failed: ${deepseekError.message}`);
    }
    
    // 3. فشل
    res.json({
      answer: "⚠️ عذراً، لم أستطع الإجابة حالياً. تأكد من اتصال الإنترنت وحاول مرة أخرى.",
      tool: "Local"
    });
    
  } catch (error) {
    console.error("Chat error:", error);
    res.json({
      answer: "عذراً، حدث خطأ",
      tool: "Local"
    });
  }
});

// ==================== تشغيل السيرفر ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🚀 PDF Assistant Backend - Server Running!                ║
║                                                              ║
║   📍 Port:      ${PORT}                                       ║
║   🔑 Gemini:    ✅ Configured                                ║
║   🔑 DeepSeek:  ✅ Configured                                ║
║                                                              ║
║   📡 Endpoints:                                              ║
║   - GET  /api/health                                         ║
║   - POST /api/translate                                      ║
║   - POST /api/chat                                           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
});