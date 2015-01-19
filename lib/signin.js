'use strict';

var fs = require('fs');
var path = require('path');
var request = require('request');
var log = require('npmlog');
var cheerio = require('cheerio');
var Table = require('cli-table');
var async = require('async');

var rootPath = path.join(path.dirname(fs.realpathSync(__filename)), '../');
var configFilePath = rootPath + 'config.json';

function doesFileExist(filePath) {
    try {
        return fs.existsSync(filePath);
    } catch (error) {
        return false;
    }
}

function signIn(callback) {
    if (!doesFileExist(configFilePath)) {
        log.error('', 'config.json 不存在!');
        return;
    }

    var config = null;

    try {
        config = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
    } catch (error) {
        log.error('', '解析 config.json 失败！');
        return;
    }

    var url = 'http://pass.hujiang.com/quick/account/?account=' + config.account + '&password=' + config.password + '&act=loginverify';
    var options = {
        url: url,
        headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Encoding': 'gzip,deflate,sdch',
            'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6,de;q=0.4',
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.111 Safari/537.36'
        }
    };

    request(options, function (error, response, body) {
        if (error) {
            log.error('', '登陆失败！');
        } else {
            if (response.statusCode === 200) {
                var bodyJSON = JSON.parse(body);

                if (bodyJSON.code !== 0) {
                    log.error('', bodyJSON.message);
                    return;
                } else {
                    log.info('', '登陆成功！');
                }

                var data = bodyJSON.data;
                var token = data.ssotoken;
                url = 'http://pass.hujiang.com/quick/synclogin.aspx?token=' + token + '&rememberdays=14&rand=' + Math.random();

                request(url , function (error, response, body) {
                    if (error) {
                        log.error('', '获取 cookie 失败！');
                    } else {
                        if (response.statusCode === 200) {
                            var cookie = response.headers['set-cookie'].slice(2).join(';');

                            callback(request.cookie(cookie));
                        } else {
                            log.error('', '获取 cookie 失败！');
                        }
                    }
                });
            } else {
                log.error('', '登陆失败！');
            }
        }
    });
}

function takeCard(cookie) {
    generateCardUrls(cookie, function (urls) {
        var table = new Table({
            head: ['', '今日打卡', '打卡概况']
        });

        log.info('', '正在打卡...');

        async.each([urls.bulo, urls.classHome], function (url, callback) {
            request.get({
                url: url.url,
                headers: {
                    'Cookie': cookie
                }
            }, function (error, response, body) {
                if (error) {
                    log.error('', url.title + '打卡失败！');
                } else {
                    if (response.statusCode === 200) {
                        var result = '';

                        if (url.title === '部落') {
                            result = JSON.parse(body);
                            if (result[0] === '' || result[0] === '0') {
                                table.push(['部落', '今日已打卡', '累计打卡 ' + result[1] + ' 天']);
                            } else {
                                table.push(['部落', '获得 ' + result[0] + ' 沪元', '累计打卡 ' + result[1] + ' 天']);
                            }
                        } else if (url.title === '网校') {
                            result = body.split('|');
                            if (!result[0].match(/^\d/g)) {
                                table.push(['网校', '今日已打卡', '连续打卡 ' + result[1] + ' 天']);
                            } else {
                                table.push(['网校', '当前学币数为 ' + result[0], '连续打卡 ' + result[1] + ' 天']);
                            }
                        }
                    } else {
                        log.error('', url.title + '打卡失败！');
                    }
                }

                callback();
            });
        }, function (err) {
            if (err) {
                log.error('', '部落或者网校打卡失败！');
            } else {
                if (urls.myClasses.length > 0) {
                    async.each(urls.myClasses, function (url, callback) {
                        request.get({
                            url: url.url,
                            headers: {
                                'Cookie': cookie
                            }
                        }, function (error, response, body) {
                            if (error) {
                                log.error('', url.title + '打卡失败！');
                            } else {
                                if (response.statusCode === 200) {
                                    if (!body.match(/^\d/g)) {
                                        table.push([url.title, '今日已打卡', '/']);
                                    } else {
                                        table.push([url.title, '当前学币数为 ' + body, '/']);
                                    }
                                } else {
                                    log.error('', url.title + '打卡失败！');
                                }
                            }

                            callback();
                        });
                    }, function (err) {
                        if (err) {
                            log.error('', '某门课程打卡失败！');
                        } else {
                            console.log(table.toString());
                        }
                    });
                } else {
                    console.log(table.toString());
                }
            }
        });
    });
}

function generateCardUrls(cookie, callback) {
    var urls = {
        bulo: {
            title: '部落',
            url: 'http://bulo.hujiang.com/app/api/ajax_take_card.ashx'
        },
        classHome: {
            title: '网校',
            url: 'http://class.hujiang.com/service/docard.ashx'
        },
        myClasses: []
    };

    request.get({
        url: 'http://class.hujiang.com/myclass/going',
        headers: {
            'Cookie': cookie
        }
    }, function (error, response, body) {
        if (error) {
            log.error('', '获取班级信息失败！');
        } else {
            if (response.statusCode === 200) {
                var $ = cheerio.load(body);
                var $classDetail = $('#classroom_detail');

                if ($classDetail.length !== 0) {
                    $classDetail.find('li').each(function () {
                        var $this = $(this);
                        var classId = $this.attr('id').replace(/li_/gi, '');
                        var title = $this.find('.my_class_name').text();

                        urls.myClasses.push({
                            title: title,
                            url: 'http://class.hujiang.com/service/docard.ashx?classid=' + classId
                        });
                    });
                }

                callback(urls);
            } else {
                log.error('', '获取班级信息失败！');
            }
        }
    });

}

module.exports = function () {
    log.info('', '正在登陆...');
    signIn(takeCard);
};
