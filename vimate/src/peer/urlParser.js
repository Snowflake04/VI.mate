import { parse } from 'engine.io-client';

function url(uri, path = '', locObj) {
  let obj = uri;
  // default to window.location
  // eslint-disable-next-line no-restricted-globals
  locObj = locObj || (typeof location !== 'undefined' && location);
  if (null == uri) uri = locObj.protocol + '//' + locObj.host;
  // relative path support
  if (typeof uri === 'string') {
    if ('/' === uri.charAt(0)) {
      if ('/' === uri.charAt(1)) {
        uri = locObj.protocol + uri;
      } else {
        uri = locObj.host + uri;
      }
    }
    if (!/^(https?|wss?):\/\//.test(uri)) {
      if ('undefined' !== typeof locObj) {
        uri = locObj.protocol + '//' + uri;
      } else {
        uri = 'https://' + uri;
      }
    }
    // parse
    obj = parse(uri);
  }
  // make sure we treat `localhost:80` and `localhost` equally
  if (!obj.port) {
    if (/^(http|ws)$/.test(obj.protocol)) {
      obj.port = '80';
    } else if (/^(http|ws)s$/.test(obj.protocol)) {
      obj.port = '443';
    }
  }
  obj.path = obj.path || '/';
  const ipv6 = obj.host.indexOf(':') !== -1;
  const host = ipv6 ? '[' + obj.host + ']' : obj.host;
  // define unique id
  obj.id = obj.protocol + '://' + host + ':' + obj.port + path;
  // define href
  obj.href =
    obj.protocol +
    '://' +
    host +
    (locObj && locObj.port === obj.port ? '' : ':' + obj.port);
  return obj;
}

export default url;
