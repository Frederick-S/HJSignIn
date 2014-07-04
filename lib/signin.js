var fs = require('fs');
var path = require('path');
var request = require('request');

var rootPath = path.join(path.dirname(fs.realpathSync(__filename)), '../');
var configFilePath = rootPath + 'config.json';
var cookieFilePath = rootPath + 'cookie.txt';

function doesFileExist(filePath) {
    try {
        return fs.existsSync(filePath);
    } catch (error) {
        return false;
    }
}

function log(message) {
    console.log(message);
}

function signIn(callback) {
    var now = new Date();
    var client_date = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();

    if (!doesFileExist(configFilePath)) {
        log('config.json does not exist!');
        return;
    }

    var config = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
    config.client_date = client_date;

    request.post('http://pass.hujiang.com/signup/handler/account/checklogin.aspx', {
        form: config
    }, function (error, response, body) {
        if (error) {
            log('Error: ' + error);
        } else {
            if (response.statusCode === 200) {
                log('登陆成功！');
                var cookie = response.headers['set-cookie'].slice(2, 4).join('');
                fs.writeFileSync('cookie.txt', cookie);

                callback();
            } else {
                log('登陆失败！');
            }
        }
    });
}

function takeCard() {
    var cookie = request.cookie(fs.readFileSync(cookieFilePath, 'utf-8'));
    request.get({
        url: 'http://bulo.hujiang.com/app/api/ajax_take_card.ashx',
        headers: {
            'Cookie': cookie
        }
    }, function (error, response, body) {
        if (error) {
            log('Error: ' + error);
        } else {
            if (response.statusCode === 200) {
                log('打卡信息如下：');
                log(body);
            } else {
                log('Error: ' + body);
            }
        }
    });
}

module.exports = function () {
    if (!doesFileExist(cookieFilePath)) {
        log('正在登陆...');
        signIn(takeCard);
    } else {
        takeCard();
    }
};
