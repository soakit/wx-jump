const path = require("path")
const fs = require("fs")
const getPixels = require("get-pixels")
const gm = require('gm')
const adb = require('node-adb')
const _ = require('lodash')

const deviceID = 'e3c7a0ac'
const imageName = "temp.png"
const faildPath = "./failed/"
const debugPath = "./debug/"
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


function checkRGB(r, g, b, x, y, pixels) {
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

function getCurPos(cb) {
    getPixels(path.resolve(imageName), function(err, pixels) {
        if (err) {
            return
        }
        const width = pixels.shape[0]
        const height = pixels.shape[1]
        let isFind = false
        // 左上角是原点
        for (let i = 0; i < width; i++) {
            for (let j = height - 1; j >=0; j--) {
                const r = pixels.get(i, j, 0)
                const g = pixels.get(i, j, 1)
                const b = pixels.get(i, j, 2)
                // if (i === 328 && j ===1129)
                if (checkRGB(r, g, b, i, j, pixels)) {
                	console.log('找到起始点:', i + 8, j + 1 - 20);
                	isFind = true
                	cb && cb({
                        x: i + 8,
                        y: j + 1 - 20
                    })
                	return
                }
            }
        }
        if (!isFind) {
        	console.log('没有找到起始点');
        	copyFile(imageName, faildPath)
        	cb && cb(null)
        }
    })
}

function findCenter(pixels, first, cb) {
	const width = pixels.shape[0]
	const xArr = [], obj = {}, rgb = []
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
        	if (r !== obj.r && b !== obj.b && g !== obj.g) {
        		xArr.push(i)
        		obj.y = j
        		rgb.push({r, g, b})
        	}
        }
        if (xArr.length > 0) {
			break
    	}
    }
    // console.log(xArr)
    // console.log(rgb, obj.y)
    const centerX = _.sum(xArr) / xArr.length
    // 值是tan 30°, math.sqrt(3) / 3
    const centerY = first.y - Math.abs(centerX - first.x) * Math.sqrt(3) / 3
    isFindEnd = true
    console.log('找到结束点:', centerX, centerY)
    cb && cb({
    	x: centerX,
    	y: centerY
	})
}

function getNextPos(cb, isFirst, first) {
    if (!isFirst) {
    	getPixels(path.resolve(imageName), function(err, pixels) {
	        if (err) {
	            return
	        }
	        const width = pixels.shape[0]
	        // const height = pixels.shape[1]
	        const circleW = 38, circleH = 22
	        let xArr = [], yArr = [], arr = []
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
	        const groupY = _.groupBy(arr, function(item) {
	        	return item.y
	        })
	        for (const i in groupY) {
	        	if (groupY[i].length >= 37 && groupY[i].length <= 39) {
	        		xArr = xArr.concat(groupY[i].map(item => item.x))
	        	}
	        }
	        const minX = Math.min.apply(Math, xArr)
	        const maxX = Math.max.apply(Math, xArr)
	        arr.forEach(item => {
	        	if (item.x < minX || item.x > maxX) {
	        		item.x = 0
	        		item.y = 0
	        	}
	        })
	        const groupX = _.groupBy(arr, function(item) {
	        	return item.x
	        })
	        for (const i in groupX) {
	        	if (groupX[i].length >= 21 && groupX[i].length <= 23) {
	        		yArr = yArr.concat(groupX[i].map(item => item.y))
	        	}
	        }
	       	// console.log(new Set(xArr))
	       	// console.log(new Set(yArr))
	        const minY = Math.min.apply(Math, yArr)
	        const maxY = Math.max.apply(Math, yArr)
	        const x = (minX + maxX) / 2
	        const y = (minY + maxY) / 2
	        if (maxX - minX > circleW || maxY - minY > circleH) {
	        	// console.log('宽:',  maxX - minX, '高:',  maxY - minY)
	        	// console.log('找错结束点了', x, y)
	        	// copyFile(imageName, faildPath)
	        	// return
	        	findCenter(pixels, first, cb)
	        }
	        if (x && y) {
	        	isFindEnd = true
		        console.log('找到结束点:', x, y)
                cb && cb({
		        	x: x,
		        	y: y
	        	})
	        } else {
	        	// console.log('没找到结束点')
                // cb && cb(null)
                findCenter(pixels, first, cb)
	        }
	    })
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
	return Math.sqrt((first.x - second.x)*(first.x - second.x) + (first.y - second.y)*(first.y - second.y))
}

function saveScreenshot(first, second, cb) {
	gm(imageName)
		.drawLine(first.x, first.y, second.x, second.y)
		.write(debugPath + Date.now() + '_l_' + imageName, function (err) {
	  		if (!err) {
	  			cb && cb()
	  		}
		});
}

function jump(first, second, isRight) {
	const distance = calc(first, second)
	saveScreenshot(first, second, function() {
		console.log('距离:', distance)
		let = pressTime = distance * (isRight ? pressCoefficient : 1.472)
	    pressTime = parseInt(pressTime)
	    pressTime = Math.max(pressTime, 240)
	    console.log('按的时间:', pressTime)
	    const destName = Date.now() + '_' + distance + '_' + pressTime + imageName
	    console.log('文件名:', destName)
	    console.log('\n')
	    adbExcute(['shell', 'input swipe', swipePos.x1, swipePos.y1, swipePos.x2, swipePos.y2, pressTime], function() {
	    	setTimeout(function() {
				main()
	    	}, 2000)
	    })
	})
}

function adbExcute(shell, cb) {
	adb({
	    deviceID: deviceID,
	    shell: shell
	},function(result){
	    cb && cb(result)
	});
}

/**
 * [copyFile description]
 * @param  {[type]} fileName [拷贝的目标文件]
 * @param  {[type]} url      [拷贝的目标文件夹]
 * @param  {[type]} destName [拷贝的目标文件名]
 * @return {[type]}          [description]
 */
function copyFile(fileName, url, destName) {
	var sourceFile = path.join(__dirname, fileName);
	var destPath = path.join(__dirname, url, destName ? destName : (Date.now() + fileName));

	var readStream = fs.createReadStream(sourceFile);
	var writeStream = fs.createWriteStream(destPath);
	readStream.pipe(writeStream);
}

function main() {
	adbExcute(['shell', 'screencap -p', '/sdcard/' + imageName], function() {
		adbExcute(['pull', '/sdcard/' + imageName, '.'], function() {
			copyFile(imageName, debugPath, Date.now() + imageName)
			getCurPos(function(first) {
				if (!first) {
					return
				}
				getNextPos(function(second1){
					if (!second1) {
						getNextPos(function(second2){
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

function main2() {
	getCurPos(function(first) {
		if (!first) {
			return
		}
		getNextPos(function(second1){
			if (!second1) {
				getNextPos(function(second2){
					jump(first, second2, second2.x > first.x)	
				}, true, first)
			} else {
				jump(first, second1, second1.x > first.x)		
			}
		}, false, first)
	})
}

main()
// main2()
