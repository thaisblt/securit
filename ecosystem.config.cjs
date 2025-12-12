module.exports = {
   apps : [
      {
         name: 'securit',
         script: './src/app.js',
         watch: false,
         env: {
            NODE_ENV: 'production'
         }
      }
   ]
}