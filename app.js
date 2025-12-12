import cookieParser from 'cookie-parser';
import express from 'express';
import path, { matchesGlob } from 'path';
import prisma from './prisma.js'
import {sendMail} from './mail.mjs'
import { getRandomCode } from './utilities.mjs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken'


const app = express();
const email2code = {};

// Définir le moteur de template
app.set('view engine', 'ejs');

// Permet de servir les fichiers statiques (logo, CSS...)
app.use(cookieParser());
app.use(express.static(path.join(process.cwd(), 'public')));
app.use(express.urlencoded({ extended: true })); // pour les formulaires POST


app.get('/', (req, res) => {
  res.render('login', {error_message:''});
});

// Vérification du code après login / inscription
app.get('/verify_code', (req, res) => {
  res.render('verify_code');
});

// Mot de passe oublié : étape 1 (entrer mail)
app.get('/forgotten_password', (req, res) => {
  res.render('forgotten_password');
});

// Mot de passe oublié : étape 2 (entrer code)
app.get('/forgotten_password_verify', (req, res) => {
  res.render('forgotten_password_verify');
});

// Mot de passe oublié : étape 3 (réinitialiser le mot de passe)
app.get('/reset_password', (req, res) => {
  res.render('reset_password');
});

// Création de compte : étape 1 (entrer mail)
app.get('/register', (req, res) => {
  res.render('register', {error_message:''});
});

// Création d'un compte => Choisir un mot de passe (après inscription ou mot de passe oublié)
app.get('/set_password', (req, res) => {
  res.render('set_password');
});

// Se connecter => Vérifier l'authentification (mail dans BD et password ok)
app.post('/check_login', async(req, res) => {
   const { email, password } = req.body;
   const user = await prisma.User.findUnique({
      where : {email}
   })

   if (user) {
      if (await bcrypt.compare(password, user.password)) { 
         const code = getRandomCode().toString();
         email2code[email] = code;
         await sendMail({
            to: email,
            subject:'code de vérification',
            html:`Code à entrer : ${code}`,
         });
         console.log({email2code});
         res.cookie('codeWait','code60s', {maxAge:60000});
         res.render('login_verify', { email, error_message: '' , attempts:0}); 
      } else {
         res.render('login', {error_message:'Email et/ou mot de passe incorrecte(s)'});
      }
   } else {
      res.render('login', {error_message:'Email et/ou mot de passe incorrecte(s)'});
   }
});

// Se connecter => Vérifier que le code est correcte
app.post('/check_login_code', async (req, res) => {
   const { email, code } = req.body;
   let attempts = req.body.attempts;
   const user = await prisma.User.findUnique({
      where: {email}
   }); 
   const name = user.name;
  console.log(email2code);

   if (attempts < 2) {
      if (req.cookies.codeWait) {
         if (code === email2code[email]) { 
            const token = jwt.sign(
               { sub: user.id },
               process.env.SECRET
            );
            res.cookie('session_token', token, {httpOnly: true, maxAge: 3600 * 1000});
            res.render('visit_list', {name}); // Doit amener vers l'accueil -> authentifiaction ok -> changer page de retour
         } else {
            attempts ++;
            res.render('login_verify', {email, error_message:"Code incorrecte", attempts});
         }
      } else {
      res.render('login_verify', {email, error_message:"Délai expiré", attempts});
      }
   } else {
      res.render('login_verify', {email, error_message:"Plus de 3 tentatives incorrectes", attempts});
   }
});

// Créer un compte : Vérifier si le mail existe
app.post('/check_register', async(req, res) => {
   const email = req.body.email.toLowerCase();
   const userList = await prisma.User.findMany({
      where : {email}
   })
   console.log('userList', userList)

   if (userList.length === 0) {   // mail envoyé que si aucun user de ce mail existe.
      const code = getRandomCode().toString();
      email2code[email] = code;
      await sendMail({
         to: email,
         subject:'code de vérification',
         html:`Code à entrer : ${code}`,
      });
      console.log({email2code});
   } 
   res.cookie('codeWait','code60s', {maxAge:60000});
   res.render('register_verify', { email, error_message: '' , attempts:0}); 
});

// stocker email et code correspondant où ? dans un dictionnaire ? (pas scalable). BD ? (non pas ça place) -> Mettre dans BD speciale pour ça : redis
// nous on va le mettre dans un dico email2code

// Créer un compte => Vérifier le code reçu
app.post('/check_register_code', (req, res) => {
   const { email, code } = req.body;
   let attempts = req.body.attempts;
   console.log(email2code);
   console.log(email);
   console.log(req.cookies.codeWait);
   console.log(attempts);

   if (attempts < 2) {
      if (req.cookies.codeWait) {
         if (code === email2code[email]) { 
            res.render('set_password', {email, error_message:""});
         } else {
            attempts ++;
            res.render('register_verify', {email, error_message:"Code incorrecte", attempts});
         }
      } else {
         res.render('register_verify', {email, error_message:"Délai expiré", attempts});
      }
   } else {
      res.render('register_verify', {email, error_message:"Plus de 3 tentatives incorrectes", attempts});
   }
});

// Créer un compte => Verifier que les mdp sont valides et ajouter l'utilisateur à la BD si info ok
app.post('/check_name_password', async(req, res) => {   
  const { email, name, password1, password2 } = req.body;
   if (password1 === password2) {
      const hashedPassword = await bcrypt.hash(password1, 4)
      await prisma.User.create({data: {
         name, 
         email, 
         password : hashedPassword}});
      res.render('login', {error_message:''});
   } else {
      res.render('set_password', {email, error_message:"Les mots de passe sont différents"});
   }  
}); 

// Mot de passe oublié : envoyé un code à l'adresse mail entrée
app.post('/check_forgotten_password', async(req, res) => {
   const email = req.body.email.toLowerCase();
   const user = await prisma.User.findUnique({
      where : {email}
   })

   if (user) {   // mail envoyé que si user existe.
      const code = getRandomCode().toString();
      email2code[email] = code;
      await sendMail({
         to: email,
         subject:'code de vérification',
         html:`Code à entrer : ${code}`,
      });
      console.log({email2code});
   } 
   res.cookie('codeWait','code60s', {maxAge:60000});
   res.render('forgotten_password_verify', { email, error_message: '' , attempts:0}); 
});

// Mot de passe oublié : vérifier le code reçu
app.post('/check_forgotten_password_code', async(req, res) => {
   const { email, code } = req.body;
   let attempts = req.body.attempts;

   console.log(email2code);

   if (attempts < 2) {
      if (req.cookies.codeWait) {
         if (code === email2code[email]) { 
            res.render('reset_password',{email, error_message:''});
         } else {
            attempts ++;
            res.render('forgotten_password_verify', {email, error_message:"Code incorrecte", attempts});
         }
      } else {
         res.render('forgotten_password_verify', {email, error_message:"Délai expiré", attempts});
      }
   } else {
      res.render('forgotten_password_verify', {email, error_message:"Plus de 3 tentatives incorrectes", attempts});
   }
});

// Vérifier que les 2 mots de passe entrés sont identiques et réinitialiser le mot de passe
app.post('/check_password', async(req, res) => {
   const { email, password1, password2 } = req.body;

   if (password1 === password2) {
      const hashedPassword = await bcrypt.hash(password1, 4)
      await prisma.User.update({
         where : {email},
         data : {password : hashedPassword}
      });
      res.render('login', {email, error_message:''});

   } else {
      res.render('reset_password', {email, error_message:"Les mots de passe sont différents"});
   }  
});

/* ESPACE PROTEGE */
/* Middlewares de "protection" avant les protected routes */
app.use(async (req, res, next) => {
   try {
      const token = req.cookies?.session_token;
      const payload = jwt.verify(token, process.env.SECRET);
      const user = await prisma.User.findUnique({
         where: {id:payload.sub}
      });
      req.user = user;
      next();

   } catch(err) {
      res.status(403).send("Reconnectez vous !");
   }
});

/* Page d'accueil après connexion : Dashboard */
app.get('/visit_list', (req, res) => {
   if (!req.user) {
      res.redirect('/');
   }
   res.render('visit_list', {name: req.user.name});
});

app.get('/new_visit', (req, res) => {
   if (!req.user) {
      res.redirect('/');
   }
   res.render('new_visit', {name: req.user.name});
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

