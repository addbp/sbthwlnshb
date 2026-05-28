import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, email, date, time, services, totalAmount } = body;

        // Connects to your email provider (e.g. Gmail)
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com', // Change this if you don't use Gmail
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER, // Your spa email (info@agoradatadriven.com)
                pass: process.env.EMAIL_PASS, // Your App Password
            },
        });

        // The beautiful HTML Email Template
        const htmlContent = `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
        <div style="background-color: #F9F4EB; padding: 40px 30px; text-align: center; border-bottom: 2px solid #C58F3B;">
          <h1 style="color: #1A1A1A; margin: 0 0 8px 0; font-size: 32px; font-weight: 300;">Booking Confirmed</h1>
          <p style="color: #C58F3B; margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700;">Sabbath Spa & Wellness Hub</p>
        </div>
        
        <div style="padding: 40px 30px; background-color: #ffffff;">
          <h2 style="color: #1A1A1A; margin-top: 0; font-size: 20px;">Hi ${name.toUpperCase()},</h2>
          <p style="color: #4A4A4A; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">Your relaxing getaway is officially on our calendar. Here are the details of your upcoming appointment:</p>
          
          <div style="background-color: #FDFCF8; padding: 24px; border-radius: 10px; border-left: 4px solid #C58F3B; margin: 25px 0;">
            <p style="margin: 0 0 12px; font-size: 15px; color: #4A4A4A;"><strong style="color: #1A1A1A;">📅 Date & Time:</strong> ${date} | ${time}</p>
            <p style="margin: 0 0 12px; font-size: 15px; color: #4A4A4A;"><strong style="color: #1A1A1A;">💆 Services:</strong> ${services}</p>
            <p style="margin: 0; font-size: 15px; color: #4A4A4A;"><strong style="color: #1A1A1A;">💳 Total Amount:</strong> ₱${totalAmount.toLocaleString()}</p>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eaeaea;">
            <p style="color: #4A4A4A; font-size: 14px; line-height: 1.6;">
              <strong style="color: #1A1A1A;">Important:</strong> Sabbath Spa will confirm your appointment 1 hour before your check-in via SMS or Call. 
            </p>
            <p style="color: #4A4A4A; font-size: 14px; line-height: 1.6;">
               If you need to make any changes or have immediate concerns, please contact us at <strong style="color: #1A1A1A;">0917 199 7772</strong>.
            </p>
          </div>
          
          <p style="color: #4A4A4A; font-size: 15px; margin-top: 40px; margin-bottom: 0;">Warm regards,<br><strong style="color: #1A1A1A; font-size: 16px;">Sabbath Spa</strong></p>
        </div>
      </div>
    `;

        await transporter.sendMail({
            from: `"Sabbath Spa" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `Booking Confirmed! - Sabbath Spa (${date})`,
            html: htmlContent,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, error: 'Failed to send email' }, { status: 500 });
    }
}