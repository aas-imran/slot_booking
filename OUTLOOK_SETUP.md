# Microsoft Outlook Email Setup Guide

## Overview
This application has been updated to send slot booking notifications to your Microsoft Outlook email address (imran@aas.technology) instead of Gmail.

## Setup Instructions

### 1. Create Environment File
1. Copy the `env-template.txt` file to `.env.local`
2. Open `.env.local` and replace `your_outlook_password_here` with your actual Outlook password

### 2. Outlook Account Configuration
For the email to work properly, you need to configure your Outlook account:

#### Option A: Use App Password (Recommended)
1. Go to your Microsoft Account settings
2. Navigate to Security → Advanced security options
3. Enable "Two-step verification" if not already enabled
4. Generate an "App password" for this application
5. Use this app password in your `.env.local` file instead of your regular password

#### Option B: Enable Less Secure Apps
1. Go to your Microsoft Account settings
2. Navigate to Security → Advanced security options
3. Enable "Allow less secure apps" (not recommended for production)

### 3. Test the Configuration
1. Start your development server: `npm run dev`
2. Try booking a slot through the application
3. Check if you receive the email at imran@aas.technology

## Email Flow
- **From**: imran@aas.technology (your Outlook address)
- **To**: imran@aas.technology (your Outlook address)
- **Content**: Includes all booking details plus the user's email address

## Troubleshooting

### Common Issues:
1. **Authentication Error**: Check your password and ensure app passwords are enabled
2. **Connection Timeout**: Verify your internet connection and firewall settings
3. **Port Blocked**: Ensure port 587 is not blocked by your network

### Debug Mode
In development mode, the application will show detailed error messages in the console and API response to help with troubleshooting.

## Security Notes
- Never commit your `.env.local` file to version control
- Use app passwords instead of your main account password
- Regularly rotate your app passwords
- Consider using environment-specific configurations for production 