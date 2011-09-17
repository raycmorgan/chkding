var http  = require('http'),
    async = require('async');

exports.getJSON = function getJSON(host, url, callback) {
  var opts = {
    host: host,
    path: url
  };
  
  var request = http.get(opts, function (res) {
    var data = '';
    
    res.on('data', function (c) { data += c; });
    res.on('end', function () {
      try {
        var j = JSON.parse(data);
      } catch (e) {
        callback(e);
      }
      
      if (j) {
        callback(null, j);
      }
    });
  });
  
  request.on('error', function (e) {
    callback(e);
    callback = function () {};
  });
  
  request.end();
}

exports.getRandomShit = function getRandomShit(callback) {
  async.parallel([
    exports.getSTP,
    exports.getZappos
  ], function (err, results) {
    
    if (err) {
      return callback(err);
    }
    
    var items = Array.prototype.concat.apply([], results);
    fisherYates(items);
    callback(null, items);
  });
}

function stlyeToImageURL(id) {
  var idPart = '/' + id.charAt(0) + '/' + id.charAt(1) + '/' + id.charAt(2) + '/' + id + '-p-LARGE_SEARCH.jpg';
  return 'http://www.zappos.com/images/z' + idPart;
}

function fisherYates(myArray) {
  var i = myArray.length;
  if (i == 0) return false;
  
  while (--i) {
     var j = Math.floor(Math.random() * (i + 1));
     var tempi = myArray[i];
     var tempj = myArray[j];
     myArray[i] = tempj;
     myArray[j] = tempi;
   }
}

exports.getSTP = function getSTP(callback) {
  var page = ~~(Math.random() * 700);
  
  exports.getJSON('api.sierratradingpost.com', '/api/1.0/products/?page=' + page + '&perpage=20&sort=SubmissionDateNewToOld&api_key=h43v82wxacjbmscz6gqyu7ar', function (err, json) {
    if (err) {
      return callback(err);
    }

    var results = json.Result.map(function (item) {
      return {
        id: item.Id,
        url: item.WebUrl,
        image: item.Images.PrimaryLarge,
        price: item.FinalPrice.toString().replace(/[$, ]|\.\d*$/g, '')
      }
    });

    callback(null, results);
  });
}

exports.getZappos = function (callback) {
  
  var page = ~~(Math.random() * 2000);
  
  exports.getJSON('api.zappos.com', '/Search?term=&page=' + page + '&limit=50&key=8e7d1bd3cc8ab78c52405cf74aa91eb5575bf941', function (err, res) {
    if (err) {
      return callback(err)
    }
    
    var results = res.results.map(function (item) {
      return {
        id: item.styleId,
        url: item.productUrl,
        image: stlyeToImageURL(item.styleId),
        price: item.price.replace(/[$, ]|\.\d*$/g, '')
      };
    });
    
    callback(null, results);
  });
}
