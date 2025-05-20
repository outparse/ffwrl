const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;

// Rate limiting constants
const MAX_SUBMISSIONS_PER_DAY = 3;
const MIN_MINUTES_BETWEEN_SUBMISSIONS = 15;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get client IP address (works with Vercel deployments)
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const ipKey = `feedback:ip:${clientIp}`;

    // Check KV store for existing submissions
    const kv = require('@vercel/kv');
    const now = Date.now();
    const submissions = await kv.get(ipKey) || { count: 0, lastSubmission: 0 };

    // Check daily limit
    if (submissions.count >= MAX_SUBMISSIONS_PER_DAY) {
      const lastSubmissionDate = new Date(submissions.lastSubmission);
      const nextAvailableDate = new Date(lastSubmissionDate.getTime() + DAY_IN_MS);
      
      return res.status(429).json({ 
        error: 'Daily limit exceeded',
        message: `You've reached the maximum of ${MAX_SUBMISSIONS_PER_DAY} submissions per day.`,
        nextAvailable: nextAvailableDate.toISOString()
      });
    }

    // Check minimum time between submissions
    const timeSinceLastSubmission = (now - submissions.lastSubmission) / (60 * 1000);
    if (timeSinceLastSubmission < MIN_MINUTES_BETWEEN_SUBMISSIONS && submissions.count > 0) {
      const nextAvailableMinutes = Math.ceil(MIN_MINUTES_BETWEEN_SUBMISSIONS - timeSinceLastSubmission);
      
      return res.status(429).json({ 
        error: 'Too many requests',
        message: `Please wait ${nextAvailableMinutes} minute(s) before submitting again.`,
        nextAvailable: new Date(now + (nextAvailableMinutes * 60 * 1000)).toISOString()
      });
    }

    // Process the submission
    const { rating, feedback, timestamp } = req.body;
    
    const message = `📢 New Feedback Received:\n\n⭐ Rating: ${rating}/5\n📝 Feedback: ${feedback}\n⏰ Timestamp: ${new Date(timestamp).toLocaleString()}\n🌐 IP: ${clientIp}`;

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'Markdown'
        })
      }
    );

    if (!telegramResponse.ok) {
      throw new Error('Failed to send to Telegram');
    }

    // Update submission count and timestamp
    const updatedSubmissions = {
      count: submissions.count + 1,
      lastSubmission: now
    };
    
    // Store with TTL of 1 day (24 hours)
    await kv.set(ipKey, updatedSubmissions, { px: DAY_IN_MS });

    return res.status(200).json({ 
      success: true,
      remainingSubmissions: MAX_SUBMISSIONS_PER_DAY - updatedSubmissions.count
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
