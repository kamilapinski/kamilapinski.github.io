## How to make tailwind changes working?

In the terminal write:
`npx @tailwindcss/cli -i ./css/style.css -o ./css/style-out.css --watch`

Now the files will be watched and every change will take effect.

## How to use PostCSS?

```bash
npm install --save-dev postcss postcss-cli cssnano
```

In `postcss.config.js` write:

```javascript
module.exports = {
  plugins: [
    require('cssnano')({
      preset: 'default', // default settings for minification
    }),
  ],
};
```

In `package.json` write:

```json
"scripts": {
  "build:css": "tailwindcss -i css/style.css -o dist/output.css && postcss dist/output.css -o dist/style.min.css"
}
```
