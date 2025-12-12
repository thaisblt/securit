import nodemailer from 'nodemailer'

export async function sendMail2({from='buisson@enseeiht.fr', to, subject, html}) {
    const transporter = 
    nodemailer.createTransport({
        host:'smtp.sendgrid.net',
        port:'587',
        secure:false,
        auth:{
            user:'apikey',
            pass: process.env.SENDGRID_PWD
        },
        name:'dufullstack.fr'
    });
    await transporter.sendMail(from, to, subject, html, html);
}

export async function sendMail({from='buisson@enseeiht.fr', to, subject, html}) {
    const transporter = nodemailer.createTransport({
        host:'smtp.sendgrid.net',
        port:'587',
        secure:false,
        auth:{
            user:'apikey',
            pass: process.env.SENDGRID_PWD
        },
        name:'dufullstack.fr'
    });
    await transporter.sendMail({ from, to, subject, html, html });
}
