const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const { OAuth2 } = google.auth;
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require('cors');

const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(cors());
const SCOPES = ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'];
const TOKEN_PATH = 'token.json';

if (fs.existsSync(TOKEN_PATH)) {
  console.log('Cleaning up leftover token file...');
  fs.unlinkSync(TOKEN_PATH);
}



// Set up OAuth2 credentials
const credentials = JSON.parse(fs.readFileSync('credentials.json'));
const oAuth2Client = new OAuth2(
  credentials.web.client_id,
  credentials.web.client_secret,
  credentials.web.redirect_uris[0]
);

let authorized = null;
let gmail = null;
let userdata = null;

// Middleware to parse JSON request bodies
app.use(bodyParser.json());



// Route to generate and send email
app.get('/connect', async (req, res) => {

  try {

    authurl = await authorize();
    console.log(authurl)
    if (authurl) {
      res.json({ authurl });

    }
    else {
      res.json({ authurl: null });
    }
  }
  catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to connect to the mail', details: error.message });
  }
});


async function checkAuthorization() {
  try {
    // Check if token exists
    if (fs.existsSync(TOKEN_PATH)) {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
      
      // Set credentials
      oAuth2Client.setCredentials(token);
      
      // Initialize Gmail client
      const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
      
      // Try to get user profile to validate credentials
      const userProfile = await getUserProfile(oAuth2Client);
      
      return { 
        gmail, 
        userdata: userProfile 
      };
    }
    
    // If no valid token, return null
    return null;
  } catch (error) {
    console.error('Authorization check failed:', error);
    return null;
  }
}

// Middleware to check authorization before sending email
const checkAuthMiddleware = async (req, res, next) => {
  try {
    const authResult = await checkAuthorization();
    
    if (!authResult) {
      return res.status(401).json({ 
        error: 'Not authorized', 
        authUrl: await authorize() 
      });
    }
    
    // Attach gmail and userdata to the request
    req.gmail = authResult.gmail;
    req.userdata = authResult.userdata;
    next();
  } catch (error) {
    console.error('Authorization middleware error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

// Helper function to strip HTML tags


// Helper function to strip HTML tags
function stripHtml(html) {
  return html.replace(/<[^>]*>?/gm, '');
}

// Function to create email body
function createEmailBody(emailContent, userData) {
  const sanitize = (str) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br />'); // Convert newlines to <br /> tags
  };

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${sanitize(emailContent.heading)}</title>
    
    <style>
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      
      html, body {
        width: 100%;
        max-width: 100%;
        overflow-x: hidden;
      }
      
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        line-height: 1.4;
        color: #333;
        background-color: #f4f4f4;
        font-size: 16px;
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
      }
      
      .email-container {
        width: 100%;
        max-width: 600px;
        margin: 0 auto;
        background-color: #ffffff;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        overflow: hidden;
      }
      
      .email-heading {
        font-size: 20px;
        font-weight: 600;
        margin: 0;
        padding: 15px;
        line-height: 1.2;
        background-color: #f8f9fa;
        border-bottom: 1px solid #e0e0e0;
      }
      
      .email-content {
        padding: 15px;
        font-size: 14px;
      }
      
      .email-greeting {
        margin-bottom: 15px;
        font-weight: 500;
      }
      
      .email-body {
        margin-bottom: 15px;
      }
      
      .email-closing {
        margin-top: 15px;
      }
      
      .email-footer {
        background-color: #f1f3f5;
        color: #6c757d;
        padding: 10px 15px;
        font-size: 12px;
        border-top: 1px solid #e0e0e0;
        display: flex;
        justify-content: flex-end;
        align-items: center;
      }
      
      .logo-container {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        width: 100%;
        height: 100%;

      }
      
      .logo-container strong {
        display: flex;
        align-items: center;
      }
      
      .email-logo {
        max-height: 25px;
        max-width: 25px;
      }
      
      @media only screen and (max-width: 480px) {
        body {
          font-size: 16px;
        }
        
        .email-container {
          width: 100%;
          margin: 0;
          border: none;
          border-radius: 0;
        }
        
        .email-heading {
          font-size: 18px;
          padding: 12px;
        }
        
        .email-content {
          padding: 12px;
          font-size: 13px;
        }
        
        .email-footer {
          padding: 8px 12px;
          font-size: 12px;
        }
        
        .logo-container {
          gap: 5px;
        }
        
        .email-logo {
          max-height: 20px;
          max-width: 20px;
          margin: 0 2px;
        }
      }
    </style>
  </head>
  
  <body>
    <div class="email-container">
      <h2 class="email-heading">${sanitize(emailContent.heading)}</h2>
      
      <div class="email-content">
        <div class="email-greeting">
          ${sanitize(emailContent.greeting)}
        </div>
        
        <div class="email-body">
          ${sanitize(emailContent.body)}
        </div>
        
        <div class="email-closing">
          ${sanitize(emailContent.closing)},<br>
          ${sanitize(userData?.name || 'Sender')}
        </div>
      </div>
      
      <div class="email-footer">
        <div class="logo-container">
          Sent by ${sanitize(userData?.name || 'Sender')} via 
          <p style="color: black;font-size: 12px; font-weight: 600; margin-left:5px"> Auto Mailer</p>
        </div>
      </div>
    </div>
  </body>
</html>
  `;
}

// Function to create email message
function createEmailMessage(from, to, subject, textBody, htmlBody, cc = '') {
  const boundary = `boundary_${Date.now()}`;
  const rawMessage = [
    `From: ${from}`,
    `To: ${to}`,
    cc ? `Cc: ${cc}` : '',
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    textBody,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    htmlBody,
    '',
    `--${boundary}--`
  ].filter(line => line !== '').join('\r\n');

  return Buffer.from(rawMessage).toString('base64');
}

// Send route handler
app.post('/send', checkAuthMiddleware, async (req, res) => {
  const { recipientEmail, emailContent, senderEmail, ccEmail = '' } = req.body;

  if (!recipientEmail || !emailContent || !senderEmail) {
    return res.status(400).json({
      error: 'Missing required email parameters',
      details: { recipientEmail: !!recipientEmail, emailContent: !!emailContent, senderEmail: !!senderEmail }
    });
  }

  try {
    const htmlBody = createEmailBody(emailContent, req.userdata);
    const textBody = `${emailContent.heading}\n\n${emailContent.greeting}\n\n${stripHtml(emailContent.body)}\n\n${emailContent.closing}\n\nSent by ${req.userdata?.name || 'Sender'}`;
    const rawMessage = createEmailMessage(senderEmail, recipientEmail, emailContent.heading, textBody, htmlBody, ccEmail);
    
    const result = await req.gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: rawMessage }
    });

    console.log("Gmail API Response:", result.data);
    res.json({ success: true, messageId: result.data.id, message: 'Email sent successfully!' });
  } catch (error) {
    res.status(500).json({
      error: 'Email sending failed',
      details: { message: error.message, code: error.code, name: error.name, fullError: error.toString() }
    });
  }
});



app.get('/info', async (req, res) => {

  userdata = await getUserProfile(oAuth2Client);
  console.log('User Profile:', userdata);
  res.json({ userdata });
});

app.get('/authorized', async (req, res) => {
  const code = req.query.code;
  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    return res.redirect('http://localhost:3001/gmail');
  }
  catch (error) {
    console.error('Error during OAuth callback:', error);
    res.status(500).send('Error during authorization');
  }
});

app.post('/logout', (req, res) => {
  try {
    // Simply remove the token file if it exists
    if (fs.existsSync(TOKEN_PATH)) {
      fs.unlinkSync(TOKEN_PATH);
    }
    // Reset global variables
    authorized = null;
    gmail = null;
    userdata = null;

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

app.post('/generate', async (req, res) => {
  const { formData } = req.body;
  try {
    const emailContent = await generateEmail(formData);
    res.json({ emailContent });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to generate email', details: error.message });
  }
});

// Function to generate email content using Gemini AI
async function generateEmail(formData) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    const structuredPrompt = `Generate a JSON response for a detailed ${formData.emailType} email with these requirements like i am sending an email to ${formData.recipientName} about ${formData.content}.:
- Email is being sent to: ${formData.recipientName}
- Main topic/purpose: ${formData.content}
- Tone should be ${formData.emailType}
- Include specific details and context from the main topic
- Make the email body at least 3-4 paragraphs with proper flow
- Ensure the greeting and closing match the ${formData.emailType} tone not include name in  closing
      
Respond ONLY with a JSON object in this exact format, without any additional text:
{
  "greeting": "A contextual and personalized greeting appropriate for the email type",
  "heading": "A clear and specific subject line that summarizes the email purpose",
  "body": "A well-structured email body with proper paragraphs, specific details, and professional tone",
  "closing": "A professional closing line appropriate for the email type",
  "signature": "A formal signature line"
}`;

    const result = await model.generateContent(structuredPrompt);
    const response = result.response;
    let text = response.text();

    // Clean the response if it contains markdown backticks or other formatting
    if (text.includes('```')) {
      text = text.replace(/```json\n?|\n?```/g, '');
    }
    text = text.trim();

    try {
      const emailParts = JSON.parse(text);
      if (!emailParts.greeting || !emailParts.heading || !emailParts.body ||
        !emailParts.closing || !emailParts.signature) {
        throw new Error('Missing required email parts');
      }
      return emailParts;
    } catch (parseError) {
      console.error('Parse error, received text:', text);
      throw new Error('Failed to parse email structure: ' + parseError.message);
    }

  } catch (error) {
    console.error('Error generating email:', error);
    throw new Error('Failed to generate email: ' + error.message);
  }
}

// Function to create a raw email message

async function getUserProfile(auth) {
  try {
    // Create OAuth2 client instance
    const oauth2 = google.oauth2({ version: 'v2', auth });

    // Get user information
    const userInfo = await oauth2.userinfo.get();

    return {
      email: userInfo.data.email,
      picture: userInfo.data.picture,
      name: userInfo.data.name
    };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
}

// Function to authorize and get the Gmail API client
async function authorize() {
  let credentials = null;
  if (fs.existsSync(TOKEN_PATH)) {
    credentials = JSON.parse(fs.readFileSync(TOKEN_PATH));
    if (credentials && credentials.refresh_token) {
      oAuth2Client.setCredentials(credentials);
      try {
        const userProfile = await getUserProfile(oAuth2Client);
        console.log('User Profile:', userProfile);
        return false;
      } catch (err) {
        console.error('Error getting user profile:', err);
      }
    }

  }

  if (!credentials || !credentials.refresh_token) {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent'
    });
    console.log('Authorize this app by visiting this URL:', authUrl);
    return authUrl;
  }
}

const deleteTokenFile = () => {
  if (fs.existsSync(TOKEN_PATH)) {
    fs.unlinkSync(TOKEN_PATH);
    console.log('Token file deleted on server shutdown.');
  }
};

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
