const Dat = require('dat-js')
const mime = require('mime/lite')
const pathAPI = require('path');

const GATEWAY_URL = 'ws://gateway.mauve.moe:3000'
const DAT_REGEX = /dat:\/\/([^\/]+)\/?(.*)?/i
const LOAD_DELAY = 3000

const searchForm = $('#controls')
const urlBox = $('#url')
const viewingBox = $('#viewing')
const loader = $('#loader')

let currentURL = 'dat://60c525b5589a5099aa3610a8ee550dcd454c3e118f7ac93b7d41b6b850272330'

urlBox.value = currentURL

const dat = new Dat({
	gateway: GATEWAY_URL
})

searchForm.addEventListener('submit', (e) => {
	e.preventDefault(true)

	const search =  urlBox.value

	navigateTo(search)
})

window.navigateTo = (navigateURL) => {
	if (navigateURL.startsWith(`dat://`)) {
		const parsed = parseURL(navigateURL)

		const archiveURL = `dat://${parsed.key}`

		currentURL = `${archiveURL}/${parsed.path}`

		urlBox.value = currentURL

		console.log('Navigating to', currentURL)

		const alreadyLoaded = dat.has(archiveURL)

		const repo = dat.get(archiveURL)

		const archive = repo.archive

		const path = `/${parsed.path}`

		if(alreadyLoaded) {
			renderContent(repo.archive, path)
		} else {
			toggleLoader(true)
			setTimeout(() => {
				renderContent(repo.archive, path)
				toggleLoader(false)
			}, LOAD_DELAY)
		}
	} else {
		const resolved = makeRelative(currentURL, navigateURL)

		navigateTo(resolved)
	}
}

function parseURL(datURL) {
	const matches = datURL.match(DAT_REGEX)
	if(!matches) throw new TypeError(`Invalid dat URL: "${datURL}"`)

	return {
		key: matches[1],
		path: matches[2] || ''
	}
}

function makeRelative(datURL, relativeURL) {
	const {key, path} = parseURL(datURL)

	const newPath = pathAPI.resolve(path, relativeURL)

	return `dat://${key}${newPath}`
}

function renderContent(archive, path) {
	archive.stat(path, (err, stat) => {
		if(stat.isFile()) {
			renderFile(archive, path)
		} else {
			renderFolder(archive, path)
		}
	})
}

function renderFolder(archive, path) {
	archive.readdir(path, (err, files) => {
		console.log("Listing", files)
		setContent(`
			<ul class="dex-list">
				<li class="dex-list-item">
					<button class="dex-link" onclick="navigateTo('/')">/</button>
				</li>
				<li class="dex-list-item">
					<button class="dex-link" onclick="navigateTo('../')">../</button>
				</li>
			${files.map((file) => `
				<li class="dex-list-item">
					<button class="dex-link" onclick="navigateTo('./${file}')">./${file}</button>
				</li>
			`).join('\n')}
			</ul>
		`)
	})
}

function renderFile(archive, path) {
	var mimeType = mime.getType(path)

	if(mimeType.match('image')) {
		getBlobURL(archive, path, mimeType, (err, blobURL) => {
			if (err) return setContent(err.message)
			setContent(`
				<img class="dex-image" src="${blobURL}" />
			`)
		})
	} else if(mimeType.match('video')) {
		getBlobURL(archive, path, mimeType, (err, blobURL) => {
			if (err) return setContent(err.message)
			setContent(`
				<video class="dex-video" controls>
					<source src="${blobURL}" type="${mimeType}">
				</video>
			`)
		})
	} else if (mimeType.match('html')) {
		getBlobURL(archive, path, mimeType, (err, blobURL) => {
			if (err) return setContent(err.message)
			setContent(`
				<iframe class="dex-iframe" src="${blobURL}"></iframe>
			`)
		})
	} else {
		getText(archive, path, (err, text) => {
			if (err) setContent(err.message)
			else setContent(`
				<pre class+'dex-text">${text}</pre>
			`)
		})
	}
}

function setContent(content) {
	viewingBox.innerHTML = content
}

function getText(archive, path, cb) {
	archive.readFile(path, 'utf-8', cb)
}

function getBlobURL(archive, path, mimeType, cb) {
	archive.readFile(path, (err, data) => {
		if(err) return cb(err)
		const blob = new Blob([data.buffer], { type: mimeType })
		console.log(blob)
		const url = URL.createObjectURL(blob)
		cb(null, url)
	})
}

function toggleLoader(state) {
	loader.classList.toggle('dex-hidden', !state)
}

function $(query) {
	return document.querySelector(query)
}

function $$(query) {
	return Array.from(document.querySelectorAll(query))
}
