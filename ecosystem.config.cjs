module.exports = {
   apps : [
      {
         name: 'securit',
         script: './app.js',
         watch: false,
         env: {
            NODE_ENV: 'production'
         }
      }
   ]
}
