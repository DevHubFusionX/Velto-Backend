/**
 * Email template utilities and HTML generators for Velto
 * Theme: Dark, Premium, Lime Green Accents
 */

const getFrontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173';
const getCurrentYear = () => new Date().getFullYear();

/**
 * Base email template wrapper with Velto branding
 */
const baseTemplate = (content, previewText = '') => `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Velto Investment</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap');
            
            body { 
                font-family: 'Outfit', 'Helvetica Neue', Arial, sans-serif; 
                line-height: 1.6; 
                color: #e5e7eb; 
                background-color: #050f05; 
                margin: 0; 
                padding: 0;
                -webkit-font-smoothing: antialiased;
            }
            .wrapper {
                width: 100%;
                background-color: #050f05;
                padding: 40px 0;
            }
            .container { 
                max-width: 600px; 
                margin: 0 auto; 
                background-color: #0a1f0a;
                border: 1px solid rgba(163, 230, 53, 0.1);
                border-radius: 24px;
                overflow: hidden;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            }
            .header { 
                padding: 40px 40px 20px; 
                text-align: center;
                background: radial-gradient(circle at top, rgba(163, 230, 53, 0.08), transparent 70%);
            }
            .brand {
                font-size: 32px;
                font-weight: 700;
                color: #ffffff;
                text-decoration: none;
                letter-spacing: -1px;
            }
            .brand span {
                color: #a3e635;
            }
            .content { 
                padding: 20px 40px 40px; 
                color: #d1d5db;
            }
            h1 {
                font-size: 24px;
                font-weight: 600;
                color: #ffffff;
                margin-top: 0;
                margin-bottom: 20px;
                text-align: center;
            }
            h2 {
                font-size: 20px;
                font-weight: 600;
                color: #ffffff;
                margin-top: 0;
            }
            p {
                margin-bottom: 24px;
                font-size: 16px;
                color: #9ca3af;
                font-weight: 300;
            }
            .button { 
                display: block;
                width: fit-content;
                margin: 32px auto;
                padding: 16px 40px; 
                background: linear-gradient(135deg, #a3e635 0%, #84cc16 100%);
                color: #050f05; 
                text-decoration: none; 
                border-radius: 14px; 
                font-weight: 700; 
                font-size: 16px;
                transition: transform 0.2s, box-shadow 0.2s;
                text-align: center;
                box-shadow: 0 10px 20px -5px rgba(163, 230, 53, 0.3);
            }
            .comparison-table {
                width: 100%;
                margin: 24px 0;
                background: rgba(255, 255, 255, 0.03);
                border-radius: 16px;
                padding: 20px;
                border: 1px solid rgba(255, 255, 255, 0.05);
            }
            .code-box {
                background: rgba(163, 230, 53, 0.1);
                border: 1px solid rgba(163, 230, 53, 0.2);
                color: #a3e635;
                font-size: 32px;
                font-weight: 700;
                letter-spacing: 8px;
                text-align: center;
                padding: 24px;
                border-radius: 16px;
                margin: 32px 0;
                font-family: monospace;
            }
            .footer { 
                text-align: center; 
                padding: 30px 40px; 
                background-color: #081608;
                border-top: 1px solid rgba(255, 255, 255, 0.05);
            }
            .footer p { 
                font-size: 13px; 
                color: #4b5563; 
                margin: 8px 0;
            }
            .social-links {
                margin-bottom: 20px;
            }
            .link {
                color: #6b7280;
                text-decoration: underline;
                font-size: 12px;
            }
            .highlight {
                color: #a3e635;
                font-weight: 600;
            }
        </style>
    </head>
    <body>
        <div class="wrapper">
            <div style="display:none;font-size:1px;color:#050f05;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
                ${previewText}
            </div>
            <div class="container">
                <div class="header">
                    <div class="brand">Velto<span>.</span></div>
                </div>
                <div class="content">
                    ${content}
                </div>
                <div class="footer">
                    <p>&copy; ${getCurrentYear()} Velto Investment Platform. All rights reserved.</p>
                    <p>Designed for premium growth.</p>
                    <div style="margin-top: 16px;">
                        <a href="#" class="link">Unsubscribe</a> &bull; 
                        <a href="#" class="link">Privacy Policy</a> &bull; 
                        <a href="#" class="link">Support</a>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
`;

/**
 * Verification email template
 */
const verificationEmailTemplate = (user, verificationToken) => {
    const verificationUrl = `${getFrontendUrl()}/verify-email?token=${verificationToken}`;
    const previewText = `Your verification code is ${verificationToken}. Complete your registration with Velto.`;
    
    const content = `
        <h1>Verify Your Identity</h1>
        <p>Hello <span class="highlight">${user.name}</span>,</p>
        <p>Welcome to <strong>Velto</strong>. To ensure the security of your financial portfolio, we need to verify your email address.</p>
        
        <p style="text-align: center; margin-bottom: 10px;">Use the following code to complete your verification:</p>
        
        <div class="code-box">${verificationToken}</div>
        
        <p>Alternatively, you can click the button below directly:</p>
        
        <a href="${verificationUrl}" class="button">Verify Email Address</a>
        
        <p style="font-size: 13px; color: #6b7280; text-align: center;">This code will expire in 10 minutes. If you didn't request this, simply ignore this email.</p>
    `;
    
    return baseTemplate(content, previewText);
};

/**
 * Password reset email template
 */
const passwordResetEmailTemplate = (user, resetToken) => {
    const resetUrl = `${getFrontendUrl()}/reset-password?token=${resetToken}`;
    const previewText = "Reset your Velto account password.";
    
    const content = `
        <h1>Reset Password</h1>
        <p>Hello <span class="highlight">${user.name}</span>,</p>
        <p>We received a request to access your Velto account. If this was you, you can set a new secure password below.</p>
        
        <a href="${resetUrl}" class="button">Secure Reset</a>
        
        <div class="comparison-table">
            <p style="margin: 0; font-size: 14px; text-align: center; color: #facc15;">
                <strong>⚠️ Security Notice</strong>
            </p>
            <p style="margin: 8px 0 0; font-size: 13px; text-align: center; color: #d1d5db;">
                This link is valid for <strong>60 minutes</strong>. Never share this link with anyone. Velto support will never ask for your password.
            </p>
        </div>

        <p style="margin-top: 30px; font-size: 13px; text-align: center; color: #4b5563;">
            Or copy this link: <br />
            <a href="${resetUrl}" style="color: #4b5563; text-decoration: none;">${resetUrl}</a>
        </p>
    `;
    
    return baseTemplate(content, previewText);
};

/**
 * Welcome email template
 */
const welcomeEmailTemplate = (user) => {
    const previewText = "Welcome to Velto. Your journey to premium wealth growth starts now.";
    
    const content = `
        <h1>Welcome to Elite Investing</h1>
        <p>Hello <span class="highlight">${user.name}</span>,</p>
        <p>Your account has been successfully verified. You now have full access to Velto's premium investment ecosystem.</p>
        
        <div class="comparison-table" style="text-align: left;">
            <p style="color: #ffffff; font-weight: 600; margin-bottom: 12px;">Your Next Steps:</p>
            <div style="display: flex; align-items: center; margin-bottom: 12px;">
                <span style="color: #a3e635; margin-right: 12px;">✓</span>
                <span style="font-size: 14px; color: #d1d5db;">Explore curated investment plans</span>
            </div>
            <div style="display: flex; align-items: center; margin-bottom: 12px;">
                <span style="color: #a3e635; margin-right: 12px;">✓</span>
                <span style="font-size: 14px; color: #d1d5db;">Fund your portfolio securely</span>
            </div>
            <div style="display: flex; align-items: center;">
                <span style="color: #a3e635; margin-right: 12px;">✓</span>
                <span style="font-size: 14px; color: #d1d5db;">Watch your wealth compound daily</span>
            </div>
        </div>
        
        <a href="${getFrontendUrl()}/dashboard" class="button">Access Dashboard</a>
        
        <p>Our financial experts are available 24/7 if you need any strategic guidance.</p>
    `;
    
    return baseTemplate(content, previewText);
};

module.exports = {
    verificationEmailTemplate,
    passwordResetEmailTemplate,
    welcomeEmailTemplate
};
