import gulp from 'gulp'
import zip from 'gulp-zip'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const firefox = process.argv[2] === 'firefox'
const directory = firefox ? 'build-firefox' : 'build'
const manifest = require(`../${directory}/manifest.json`)

gulp
  .src(`${directory}/**`, { encoding: false })
  .pipe(zip(`${manifest.name.replaceAll(' ', '-')}${firefox ? '-firefox' : ''}-${manifest.version}.zip`))
  .pipe(gulp.dest('package'))
