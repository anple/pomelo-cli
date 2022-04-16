var cliff = require('cliff');
var async = require('async');
var crypto = require('crypto');
var consts = require('./consts');

var util = {};

module.exports = util;

var serverMap = {};

function log(str) {
	process.stdout.write(str + '\n');
}

function help() {
	var HELP_INFO_1 = consts.HELP_INFO_1;
	for (var i = 0; i < HELP_INFO_1.length; i++) {
		util.log(HELP_INFO_1[i]);
	}

	var COMANDS_ALL = consts.COMANDS_ALL;
	util.log(cliff.stringifyRows(COMANDS_ALL));

	var HELP_INFO_2 = consts.HELP_INFO_2;
	for (var i = 0; i < HELP_INFO_2.length; i++) {
		util.log(HELP_INFO_2[i]);
	}
}

function errorHandle(comd, rl) {
	log('\nunknow command : ' + comd);
	log('type help for help infomation\n');
	rl.prompt();
}

function argsFilter(argv) {
	var lines;
	if(argv.indexOf('\'') > 0) { 
		lines = argv.split('\'');
	}
  var getArg = function(argv) {
		var argvs = argv.split(' ');
		for (var i = 0; i < argvs.length; i++) {
			if (argvs[i] === ' ' || argvs[i] === '') {
				argvs.splice(i, 1);
			}
		}
		return argvs;
  };
	if(!!lines) {
		var head = getArg(lines[0]);
		for(var i = 1; i < lines.length-1; i++) {
			head = head.concat(lines[i]);
		}
		var bottom = getArg(lines[lines.length-1]);
		return head.concat(bottom);
	} else {
		return getArg(argv);
  }
}

function sortByServerId(aId, bId, asc) {
    var aArr = aId.split('-');
    var bArr = bId.split('-');
    if(aArr[0] === 'master' || bArr[0] === 'master'){
        //show master on first row
        if(aArr[0] === bArr[0]){
            var dv = (Number(aArr[aArr.length-1]) || 0) - (Number(bArr[bArr.length-1]) || 0);
            return (!!asc) ? dv : -dv;
        } else if(aArr[0] === 'master'){
            return (!!asc) ? -1 : 1;
        } else if(bArr[0] === 'master'){
            return (!!asc) ? 1 : -1;
        }
    }

    var dt = aArr[0].localeCompare(bArr[0]);
    if(dt === 0){
        var dv = (Number(aArr[aArr.length-1]) || 0) - (Number(bArr[bArr.length-1]) || 0);
        return (!!asc) ? dv : -dv;
    }else{
        return (!!asc) ? dt : -dt;
    }
}

function formatUpTime(time){
    time = parseInt(time);
    let sec = '0' + time % 60;
    let min = '0' + Math.floor(time / 60) % 60;
    let hour = '0' + Math.floor(time / 60 / 60) % 24;
    let day = Math.floor(time / 86400);
    if(day){
        return `${day}D ${hour.substring(hour.length -2)}:${min.substring(min.length -2)}:${sec.substring(sec.length -2)}`;
    }else{
        return `${hour.substring(hour.length -2)}:${min.substring(min.length -2)}:${sec.substring(sec.length -2)}`;
    }
}

function formatOutput(comd, data) {
	if (comd === 'servers') {
		var msg = data.msg;
		var rows = [];
		var header = [];
		var results = [];
		serverMap = {};
		serverMap["all"] = 1;
		header.push(['serverId', 'serverType', 'host', 'port', 'pid', 'heapUsed(M)', 'uptime']);
		var color = getColor(header[0].length);
		for (var key in msg) {
			var server = msg[key];
			if (!server['port']) {
				server['port'] = null;
			}
			serverMap[server['serverId']] = 1;
			rows.push([server['serverId'], server['serverType'], server['host'], server['port'], server['pid'], server['heapUsed'], formatUpTime(Number(server['uptime'])*60)]);
		}
		
		rows.sort(function (a, b) {
		    return sortByServerId(a[0], b[0], true);
		});
		
		results = header.concat(rows);
		log('\n' + cliff.stringifyRows(results, color) + '\n');
		return;
		
		//async.sortBy(rows, function(server, callback) {
		//	callback(null, server[0]);
		//}, function(err, _results) {
		//	results = header.concat(_results);
		//	log('\n' + cliff.stringifyRows(results, color) + '\n');
		//	return;
		//});
	}

	if (comd === 'connections') {
		var msg = data.msg;
		var header = [];
		var rows = [];
		var color = getColor(3);
		header.push(['serverId', 'totalConnCount', 'loginedCount']);
		var sumConnCount = 0,
		    sumloginedCount = 0;
		for (var key in msg) {
			var server = msg[key];
			rows.push([server['serverId'], server['totalConnCount'], server['loginedCount']]);
			sumConnCount += server['totalConnCount'];
			sumloginedCount += server['loginedCount'];
		}
		
		rows.sort(function (a, b) {
            		return sortByServerId(a[0], b[0], true);
        	});
		
		rows = header.concat(rows);
		rows.push(['sum connections', sumConnCount, sumloginedCount]);
		log('\n' + cliff.stringifyRows(rows, color) + '\n');
		return;
	}

	if (comd === 'logins') {
		var msg = data.msg;
		var rows = [];
		var color = getColor(3);
		rows.push(['loginTime', 'uid', 'address']);
		for (var key in msg) {
			var server = msg[key];
			var loginedList = server['loginedList'] || [];
			if (loginedList && loginedList.length === 0) {
				log('\nno user logined in this connector\n');
				return;
			}
			log('\nserverId: ' + server['serverId'] + ' totalConnCount: ' + server['totalConnCount'] + ' loginedCount: ' + server['loginedCount']);
			for (var i = 0; i < loginedList.length; i++) {
				rows.push([format_date(new Date(loginedList[i]['loginTime'])), loginedList[i]['uid'], loginedList[i]['address']]);
			}
			log('\n' + cliff.stringifyRows(rows, color) + '\n');
			return;
		}
	}

	if (comd === 'modules') {
		var msg = data.msg;
		log('\n' + consts.MODULE_INFO);
		log(data.msg + '\n');
		return;
	}

	if (comd === 'status') {
		var msg = data.msg;
		var server = msg.body;
		var rows = [];
		rows.push(['time', 'serverId', 'serverType', 'pid', 'cpuAvg', 'memAvg', 'vsz', 'rss', 'usr', 'sys', 'gue']);
		var color = getColor(rows[0].length);
		if (server) {
			rows.push([server['time'], server['serverId'], server['serverType'], server['pid'], server['cpuAvg'], server['memAvg'], server['vsz'], server['rss'], server['usr'], server['sys'], server['gue']]);
			log('\n' + cliff.stringifyRows(rows, color) + '\n');
		} else {
			log('\n' + consts.STATUS_ERROR + '\n');
		}
		return;
	}

	if (comd === 'config' || comd === 'components' || comd === 'settings' || comd === 'get' || comd === 'set' || comd === 'exec' || comd === 'run') {
		log('\n' + cliff.inspect(data) + '\n');
		return;
	}

	if (comd === 'stop') {
		return
	}

	if (comd === 'add') {
		return
	}

	if (comd === 'proxy' || comd === 'handler') {
		log('\n' + cliff.inspect(data) + '\n');
		return
	}

	if (comd === 'memory' || comd === 'cpu') {
		log(data + '\n');
		return;
	}
}

function format_date(date, friendly) {
	var year = date.getFullYear();
	var month = date.getMonth() + 1;
	var day = date.getDate();
	var hour = date.getHours();
	var minute = date.getMinutes();
	var second = date.getSeconds();

	if (friendly) {
		var now = new Date();
		var mseconds = -(date.getTime() - now.getTime());
		var time_std = [1000, 60 * 1000, 60 * 60 * 1000, 24 * 60 * 60 * 1000];
		if (mseconds < time_std[3]) {
			if (mseconds > 0 && mseconds < time_std[1]) {
				return Math.floor(mseconds / time_std[0]).toString() + ' 秒前';
			}
			if (mseconds > time_std[1] && mseconds < time_std[2]) {
				return Math.floor(mseconds / time_std[1]).toString() + ' 分钟前';
			}
			if (mseconds > time_std[2]) {
				return Math.floor(mseconds / time_std[2]).toString() + ' 小时前';
			}
		}
	}

	//month = ((month < 10) ? '0' : '') + month;
	//day = ((day < 10) ? '0' : '') + day;
	hour = ((hour < 10) ? '0' : '') + hour;
	minute = ((minute < 10) ? '0' : '') + minute;
	second = ((second < 10) ? '0' : '') + second;

	return year + '-' + month + '-' + day + ' ' + hour + ':' + minute;
};

function getColor(len) {
	var color = [];
	for (var i = 0; i < len; i++) {
		color.push('blue');
	}
	return color;
}

function md5(str) {
	var md5sum = crypto.createHash('md5');
	md5sum.update(str);
	str = md5sum.digest('hex');
	return str;
}

function tabComplete(hits, line, map, comd) {
	if(hits.length) {
		return hits;
	}

	if (comd === "enable" || comd === "disable") {
		map = {
			"app": 1,
			"module": 1
		};
	} 

	if (comd === "dump") {
		map = {
			"memory": 1,
			"cpu": 1
		};
	}

	if (comd === "use" || comd === "stop") {
		map = serverMap;
	}

	// var _hits = [];
	for (var k in map) {
	  var t = k;
	  if(comd !== "complete") {
	    t = comd + " " + k;
	  }
      if (t.indexOf(line) === 0) {
        hits.push(t);
      }
    }

    hits.sort();
    return hits;
}

util.log = log;
util.md5 = md5;
util.help = help;
util.tabComplete = tabComplete;
util.argsFilter = argsFilter;
util.format_date = format_date;
util.errorHandle = errorHandle;
util.formatOutput = formatOutput;
