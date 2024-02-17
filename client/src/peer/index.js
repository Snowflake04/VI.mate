import url from './urlParser';
import { Manager } from 'socket.io-client';
import Peer from './peer';

export const getPeer = (uri, opts) => {
  if (typeof uri === 'object') {
    opts = uri;
    uri = undefined;
  }
  opts = opts || {};
  const parsed = url(uri, opts.path || '/socket.io');
  const io = new Manager(parsed.source, opts);

  return new Peer(io, parsed.path, opts);
}
