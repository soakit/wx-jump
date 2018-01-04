const path = require('path')
const fs = require('fs')
const getPixels = require('get-pixels')
const gm = require('gm')
const adb = require('node-adb')
const _ = require('lodash')

const isDebug = process.env.DEBUG - 0
const deviceID = 'e3c7a0ac'
let imageName = 'temp.png'
const testPath = './test/'
const faildPath = './failed/'
const debugPath = './debug/'
const scoreUpHeight = 300
let isFindEnd = false
// 可能要调节 start
const initSecondDot = {
	x: 789,
	y: 850
}
const swipePos = {
	x1: 320,
	y1: 410,
	x2: 330,
	y2: 420
}
const pressCoefficient = 1.468
// 可能要调节 end

function inRange(r, g, b) {
	if (
		(r >= 50 && r <= 60) &&
		(g >= 52 && g <= 62) &&
		(b >= 95 && b <= 105)
		//
		// (r >= 53 && r <= 58) &&
		// (g >= 58 && g <= 60) &&
		// (b >= 98 && b <= 102)
	) {
		return true
	}
	return false
}

function checkRGB(r, g, b, x, y, pixels) {
	const num = 18
	if (inRange(r, g, b)) {
		for (const len = x + num; x < len; x++) {
			const nextR = pixels.get(x, y, 0)
            const nextG = pixels.get(x, y, 1)
            const nextB = pixels.get(x, y, 2)
            // if (x >= 328 && x<= 328 + num && y === 1129) {
            // 	console.log('r,g,b', nextR, nextG, nextB, ' x, y', x, y, 'inRange', inRange(nextR, nextG, nextB))
            // }
			if (x !== len - 1) {
				// 前面17个不在范围内就false
				if (!inRange(nextR, nextG, nextB)) {
					return false
				}
			} else {
				// 第18个不在范围内就true
				if (!inRange(nextR, nextG, nextB)) {
					return true
				}
			}
		}
		return false
	}
	return false
}

function getCurPos(cb, name) {
	let res = path.resolve(imageName)
	if (name) {
		res = path.join(__dirname, name)
		imageName = name
	}
    getPixels(res, function(err, pixels) {
        if (err) {
            return
        }
        const width = pixels.shape[0]
        const height = pixels.shape[1]
        let isFind = false, arr = [], y = 0
		// 从距底部180开始
		for (let j = height - 180; j >= 0; j--) {
			arr = []
        	// 左上角是原点
        	for (let i = 0; i < width; i++) {
                const r = pixels.get(i, j, 0)
                const g = pixels.get(i, j, 1)
				const b = pixels.get(i, j, 2)
				if (inRange(r, g, b)) {
					arr.push(i)
					y = j
				}
                // if (checkRGB(r, g, b, i, j, pixels)) {
				// 	console.log('找到起始点:', i + 8, j + 1 - 20)
				// 	isFind = true
				// 	cb && cb(pixels, {
				// 		x: i + 8,
				// 		y: j + 1 - 20
				// 	})
				// 	return
                // }
			}
			// 12 22
			if (arr.length >= 10 && arr.length <= 30) {
				isFind = true
				const minX = Math.min.apply(Math, arr)
				const maxX = Math.max.apply(Math, arr)
				cb && cb(pixels, {
					x: (minX + maxX) / 2,
					y: y + 1 - 20
				})
				console.log('找到起始点:', (minX + maxX) / 2, y + 1 - 20)
				break
			}
        }
        if (!isFind) {
			console.log('没有找到起始点')
			copyFile(imageName, faildPath)
			cb && cb(null)
        }
    })
}

function findCenter(pixels, first, cb) {
	console.log('使用块的上顶点和左顶点找中间点')
	const width = pixels.shape[0]
	const xArr = [], xArr2 = [], obj = {}, rgb = [], diff = 5
	let centerTop = 0
	for (let j = scoreUpHeight; j <= first.y; j++) {
		for (let i = 0; i <= width; i++) {
			const r = pixels.get(i, j, 0)
			const g = pixels.get(i, j, 1)
			const b = pixels.get(i, j, 2)
			if (i === 0) {
				obj.r = r
				obj.g = g
				obj.b = b
			}
			// 中点的x值不会在第一个点x附近
			if (i >= first.x - 30 && i <= first.x + 30) {
				continue
			}
			// 在差值外就push
			if (
				r < obj.r - diff || r > obj.r + diff ||
				g < obj.g - diff || g > obj.g + diff ||
				b < obj.b - diff || b > obj.b + diff
			) {
				xArr.push(i)
				centerTop = j
				rgb.push({r, g, b})
			}
		}
		if (xArr.length > 0) {
			break
		}
	}

	const centerX = _.sum(xArr) / xArr.length
    // console.log('xArr', xArr)
	// console.log(rgb, obj)
	console.log('顶点坐标:', centerX, centerTop)

	let maxJ = 0, i = 0, firstX = 0
	if (centerX >= first.x) { // 右边
		// 暂且估计最大块的宽度是500
		firstX = Math.floor(Math.max(centerX - 500 / 2, first.x + 35))
		maxJ = Math.min((centerX - (firstX)) * Math.sqrt(3) / 3 + centerTop, first.y)
		console.log('初始i, 初始j, 最大i, 最大j:', firstX, centerTop, centerX, maxJ)
	} else {
		maxJ = Math.min(centerX * Math.sqrt(3) / 3 + centerTop, first.y)
		console.log('初始i, 初始j, 最大i, 最大j:', i, centerTop, centerX, maxJ)
	}
	drawRect({x: firstX | i, y: centerTop}, {x: centerX, y: maxJ}, function() {
		for (let j = centerTop; j <= maxJ; j++) {
			let isFirst = false
			if (centerX >= first.x) { // 右边
				i = firstX
			} else {
				i = 0
			}
			for (; i <= centerX; i++) {
				const r = pixels.get(i, j, 0)
				const g = pixels.get(i, j, 1)
				const b = pixels.get(i, j, 2)
				if (!isFirst) {
					obj.r = r
					obj.g = g
					obj.b = b
					isFirst = true
				}
				
				// 在差值外就push
				if (
					(r < obj.r - diff || r > obj.r + diff) &&
					(g < obj.g - diff || g > obj.g + diff) &&
					(b < obj.b - diff || b > obj.b + diff)
				) {
					xArr2.push({
						x: i,
						y: j,
						r_g_b: `${r}_${g}_${b}`
					})
					break
				}
			}
		}
		const groupRGB = _.groupBy(xArr2, function(o) {
			return o.r_g_b
		})
		const groupX = _.groupBy(xArr2, function(o) {
			return o.x
		})
		const arr = []
		for (const i in groupRGB) {
			arr.push(groupRGB[i])
		}
		const arrX = []
		for (const i in groupX) {
			arrX.push(groupX[i])
		}
		const sortedArr = _.sortBy(arr, function(o) {
			return o.length 
		})
		// fix #16
		const sortedArrX = _.sortBy(arrX, function(o) {
			return o.length 
		})
		const lastItem = sortedArr[sortedArr.length - 1]
		const lastItem2 = sortedArrX[sortedArrX.length - 1]
		const centerLeftArr = lastItem.map(item => item.x)
		const centerLeftArr2 = lastItem2.map(item => item.x)
		console.log(lastItem, lastItem2)
		const centerLeft = Math.max(
			Math.min.apply(Math, centerLeftArr),
			Math.min.apply(Math, centerLeftArr2)
		)
		if (isDebug === 1) {
			console.log('centerLeft:', centerLeft)
		}
		// 值是tan 30°, math.sqrt(3) / 3
		const centerY = centerTop + Math.sqrt(3) / 3 * Math.abs(centerX - centerLeft)
		isFindEnd = true
		console.log('找到结束点:', centerX, centerY)
		cb && cb({
			x: centerX,
			y: centerY
		})
	})
}

function getNextPos(pixels, cb, isFirst, first) {
    if (!isFirst) {
		const width = pixels.shape[0]
		// const height = pixels.shape[1]
		const circleW = 38, circleH = 22
		let xArr = [], arr = []
		for (let i = 0; i <= width; i++) {
			for (let j = scoreUpHeight; j <= first.y; j++) {
				const r = pixels.get(i, j, 0)
				const g = pixels.get(i, j, 1)
				const b = pixels.get(i, j, 2)
				if (r === 245 && g === 245 && b === 245) {
					arr.push({
						x: i,
						y: j
					})
				}
			}
		}
		const groupX = _.groupBy(arr, function(item) {
			return item.x
		})
		const groupY = _.groupBy(arr, function(item) {
			return item.y
		})
		for (const i in groupY) {
			if (groupY[i].length >= 37 && groupY[i].length <= 39) {
				xArr = xArr.concat(groupY[i].map(item => item.x))
			}
		}
		if (!xArr.length) {
			findCenter(pixels, first, cb)
			return
		}
		const minX = Math.min.apply(Math, xArr)
		const maxX = Math.max.apply(Math, xArr)
		const x = (minX + maxX) / 2
		const yObjArr = groupX[Math.floor(x)] || groupX[Math.ceil(x)]
		const yArr = yObjArr.map(item => item.y)
		const minY = Math.min.apply(Math, yArr)
		const maxY = Math.max.apply(Math, yArr)
		const y = (minY + maxY) / 2
		if (maxX - minX > circleW || maxY - minY > circleH) {
			console.log('宽:', maxX - minX, '高:', maxY - minY)
			console.log('找错结束点:', x, y)
			copyFile(imageName, faildPath)
			findCenter(pixels, first, cb)
		} else {
			if (x && y) {
				isFindEnd = true
				console.log('找到结束点:', x, y)
				cb && cb({
					x: x,
					y: y
				})
			} else {
				findCenter(pixels, first, cb)
			}
		}
    } else {
		if (!isFindEnd) {
			console.log('用初始节点处理！')
			cb && cb(initSecondDot)
		} else {
			copyFile(imageName, faildPath)
		}
    }
}

function calc(first, second) {
	return Math.sqrt((first.x - second.x) * (first.x - second.x) + (first.y - second.y) * (first.y - second.y))
}

function drawRect(first, second, cb) {
	gm(path.join(__dirname, imageName))
		.fill()
		.stroke('black', 1)
		.drawRectangle(first.x, first.y, second.x, second.y)
		.write(path.join(__dirname, debugPath + Date.now() + '_rect.png'), function (err) {
			if (!err) {
				cb && cb()
			}
		})
}

function drawLine(first, second, cb) {
	gm(path.join(__dirname, imageName))
		.drawLine(first.x, first.y, second.x, second.y)
		.write(path.join(__dirname, debugPath + Date.now() + '_line.png'), function (err) {
			if (!err) {
				cb && cb()
			}
		})
}

function jump(first, second, isRight) {
	drawLine(first, second, async function() {
		const distance = calc(first, second)
		console.log('距离:', distance)
		let pressTime = distance * (isRight ? pressCoefficient : 1.48)
		pressTime = parseInt(pressTime)
		pressTime = Math.max(pressTime, 240)
		console.log('按的时间:', pressTime)
		const destName = Date.now() + '_' + distance + '_' + pressTime
		console.log('文件名:', destName)
		console.log('\n')
		if (isDebug) {
			if (isDebug === 2) {
				await sleep(1000)
				const name = path.parse(imageName).name - 0
				test(name + 1)
			}
			return
		}
		const randomNum = 56
		adbExcute(['shell', 'input swipe', _.random(swipePos.x1 - randomNum , swipePos.x1 + randomNum), _.random(swipePos.y1 - randomNum , swipePos.y1 + randomNum), _.random(swipePos.x2 - randomNum , swipePos.x2 + randomNum), _.random(swipePos.y2 - randomNum , swipePos.y2 + randomNum), pressTime], async function() {
			await sleep(3000)
			main()
		})
	})
}

function adbExcute(shell, cb) {
	adb({
		deviceID: deviceID,
		shell: shell
	}, function(result) {
		if (result === undefined || result && result.indexOf('pulled') !== -1) {
			cb && cb(result)
		}
	})
}

function sleep(millis) {
    return new Promise(resolve => setTimeout(resolve, millis))
}

/**
 * [copyFile description]
 * @param  {[type]} fileName [拷贝的目标文件]
 * @param  {[type]} url      [拷贝的目标文件夹]
 * @param  {[type]} destName [拷贝的目标文件名]
 * @return {[type]}          [description]
 */
function copyFile(fileName, url, destName) {
	if (isDebug === 2) {
		return
	}
	var sourceFile = path.join(__dirname, fileName)
	var destPath = path.join(__dirname, url, destName || (Date.now() + fileName))

	var readStream = fs.createReadStream(sourceFile)
	var writeStream = fs.createWriteStream(destPath)
	readStream.pipe(writeStream)
}

function main() {
	adbExcute(['shell', 'screencap -p', '/sdcard/' + imageName], function() {
		adbExcute(['pull', '/sdcard/' + imageName, '.'], function() {
			copyFile(imageName, debugPath, Date.now() + imageName)
			getCurPos(function(pixels, first) {
				if (!first) {
					return
				}
				getNextPos(pixels, function(second1) {
					if (!second1) {
						getNextPos(pixels, function(second2) {
							jump(first, second2, second2.x > first.x)
						}, true, first)
					} else {
						jump(first, second1, second1.x > first.x)
					}
				}, false, first)
			})
		})
	})
}

function debug() {
	getCurPos(function(pixels, first) {
		if (!first) {
			return
		}
		getNextPos(pixels, function(second1) {
			if (!second1) {
				getNextPos(pixels, function(second2) {
					jump(first, second2, second2.x > first.x)
				}, true, first)
			} else {
				jump(first, second1, second1.x > first.x)
			}
		}, false, first)
	})
}

function test(i) {
	getCurPos(function(pixels, first) {
		if (!first) {
			return
		}
		getNextPos(pixels, function(second1) {
			if (!second1) {
				getNextPos(pixels, function(second2) {
					jump(first, second2, second2.x > first.x)
				}, true, first)
			} else {
				jump(first, second1, second1.x > first.x)
			}
		}, false, first)
	}, testPath + i + '.png')
}


switch(isDebug) {
	case 0:
		main()
		break
	case 1:
		debug()
		break
	case 2:
		test(100)
		break
}
