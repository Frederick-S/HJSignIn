var fs = require('fs');
var path = require('path');
var request = require('request');
var log = require('npmlog');
var cheerio = require('cheerio');
var Table = require('cli-table');

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

function signIn(callback) {
    var now = new Date();
    var client_date = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();

    if (!doesFileExist(configFilePath)) {
        log.error('', 'config.json 不存在!');
        return;
    }

    var config = null;

    try {
        config = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
        config.client_date = client_date;
    } catch (error) {
        log.error('', error);
        return;
    }

    request.post('http://pass.hujiang.com/signup/handler/account/checklogin.aspx', {
        form: config
    }, function (error, response, body) {
        if (error) {
            log.error('', 'Error: ' + error);
        } else {
            if (response.statusCode === 200) {
                log.info('', '登陆成功！');
                var cookie = response.headers['set-cookie'].slice(2, 4).join('');
                fs.writeFileSync('cookie.txt', cookie);

                callback();
            } else {
                log.error('', '登陆失败！');
            }
        }
    });
}

function takeCard() {
    var cookie = null;

    try {
        cookie = request.cookie(fs.readFileSync(cookieFilePath, 'utf-8'));
    } catch (error) {
        log.error('', '读取 cookie 文件失败！');
    }

    request.get({
        url: 'http://bulo.hujiang.com/app/api/ajax_take_card.ashx',
        headers: {
            'Cookie': cookie
        }
    }, function (error, response, body) {
        if (error) {
            log.error('', 'Error: ' + error);
        } else {
            if (response.statusCode === 200) {
                log.info('', '打卡信息如下：');
                log.info('', body);
            } else {
                log.error('', 'Error: ' + body);
            }
        }
    });
}

module.exports = function () {
    if (!doesFileExist(cookieFilePath)) {
        log.info('', '正在登陆...');
        signIn(takeCard);
    } else {
        takeCard();
    }
};
