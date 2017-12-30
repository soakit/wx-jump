const path = require("path")
const fs = require("fs")
const getPixels = require("get-pixels")
const adb = require('node-adb');

const deviceID = 'e3c7a0ac'
const imageName = "temp.png"
const faildPath = "./failed"
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
const pressCoefficient = 1.488
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
        // console.log(
        //  pixels.get(width - 1, 0, 0),
        //  pixels.get(width - 1, 0, 1),
        //  pixels.get(width - 1, 0, 2),
        //  pixels.get(width - 1, 0, 3)
        // )

        // (56 55 96) (56 55 96)
		// (55 56 97) (55 56 97)
		// or
		// (56 56 96) (56 55 96)
		// (55 56 97) (55 56 97)
		// or
		// (55 56 97) (56 55 95)
		// (55 56 97) (55 56 97)
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
                // const str = `(${r} ${g} ${b})`
                // if (str !== '(56 55 96)' && str !== '(56 56 96)' && str !== '(55 56 97)') {
                // 	continue
                // }
                // // console.log(i, j);
                // const nextR = pixels.get(i + 1, j, 0)
                // const nextG = pixels.get(i + 1, j, 1)
                // const nextB = pixels.get(i + 1, j, 2)
                // const nextLineR = pixels.get(i, j + 1, 0)
                // const nextLineG = pixels.get(i, j + 1, 1)
                // const nextLineB = pixels.get(i, j + 1, 2)
                // if (
                //     nextR === 56 && nextG === 55 && nextB === 96 &&
                //     nextLineR === 55 && nextLineG === 56 && nextLineB === 97
                // ) {
                // 	isFind = true
                //     // 找到的是左上角的格子456 1054
                //     // 中心格子是457 1055
                //     console.log('找到起始点:', i, j);
                //     cb && cb({
                //         x: i + 1,
                //         y: j + 1
                //     })
                // }
            }
        }
        if (!isFind) {
        	console.log('没有找到起始点');
        	copyFile(imageName, faildPath)
        	cb && cb(null)
        }
    })
}

function getNextPos(cb, isFirst) {
    if (!isFirst) {
    	getPixels(path.resolve(imageName), function(err, pixels) {
	        if (err) {
	            return
	        }
	        const width = pixels.shape[0]
	        const height = pixels.shape[1]
	        const xArr = [], yArr = []
	        for (let i = 0; i <= width; i++) {
	            for (let j = 0; j <= height; j++) {
	                const r = pixels.get(i, j, 0)
	                const g = pixels.get(i, j, 1)
	                const b = pixels.get(i, j, 2)
	                if (r === 245 && g === 245 && b === 245) {
	                	xArr.push(i)
	                	yArr.push(j)
	                } else {
	                	continue
	                }
	            }
	        }
	        const x = (Math.min.apply(Math, xArr) + Math.max.apply(Math, xArr)) / 2
	        const y = (Math.min.apply(Math, yArr) + Math.max.apply(Math, yArr)) / 2
	        // console.log(xArr, yArr)
	        if (x && y) {
	        	isFindEnd = true
		        console.log('找到结束点:', x, y)
                cb && cb({
		        	x: x,
		        	y: y
	        	})
	        } else {
	        	console.log('没找到结束点')
                cb && cb(null)
	        }
	    })
    } else {
    	if (!isFindEnd) {
    		console.log('用初始节点处理！')
    		cb && cb(initSecondDot)	
    	} else {
    		copyFile(imageName, faildPath)
    		process.exit(0)
    	}
    	
    }
}

function calc(first, second) {
	return Math.sqrt((first.x - second.x)*(first.x - second.x) + (first.y - second.y)*(first.y - second.y))
}

function jump(distance) {
	console.log('距离:', distance)
	let = pressTime = distance * pressCoefficient
    pressTime = Math.max(pressTime, 200)   
    pressTime = parseInt(pressTime)
    console.log('按的时间:', pressTime)
    adbExcute(['shell', 'input swipe', swipePos.x1, swipePos.y1, swipePos.x2, swipePos.y2, pressTime], function() {
    	// setTimeout(function() {
    	// 	main()
    	// }, 5000)
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

function main() {
	adbExcute(['shell', 'screencap -p', '/sdcard/' + imageName], function() {
		adbExcute(['pull', '/sdcard/' + imageName, '.'], function() {
			getCurPos(function(first) {
				if (!first) {
					process.exit(0)
					return
				}
				getNextPos(function(second1){
					if (!second1) {
						getNextPos(function(second2){
							jump(calc(first, second2))
						}, true)
					} else {
						jump(calc(first, second1))	
					}
				})
			})
		})
	})	
}

/**
 * 拷贝文件
 * @param  {[type]} fileName [拷贝的目标文件]
 * @param  {[type]} url      [拷贝的目标文件夹]
 * @return {[type]}          
 */
function copyFile(fileName, url) {
	var sourceFile = path.join(__dirname, fileName);
	var destPath = path.join(__dirname, url, Date.now() + fileName);

	var readStream = fs.createReadStream(sourceFile);
	var writeStream = fs.createWriteStream(destPath);
	readStream.pipe(writeStream);
	console.log(`copy failed file successfully!`)
	// width: 76 
	// bottom: 20
}

main()