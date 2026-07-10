"use strict";var qs=Object.create;var Oe=Object.defineProperty;var Gs=Object.getOwnPropertyDescriptor;var zs=Object.getOwnPropertyNames;var Vs=Object.getPrototypeOf,Js=Object.prototype.hasOwnProperty;var H=(s,e)=>()=>(e||s((e={exports:{}}).exports,e),e.exports),Ks=(s,e)=>{for(var t in e)Oe(s,t,{get:e[t],enumerable:!0})},tn=(s,e,t,n)=>{if(e&&typeof e=="object"||typeof e=="function")for(let i of zs(e))!Js.call(s,i)&&i!==t&&Oe(s,i,{get:()=>e[i],enumerable:!(n=Gs(e,i))||n.enumerable});return s};var S=(s,e,t)=>(t=s!=null?qs(Vs(s)):{},tn(e||!s||!s.__esModule?Oe(t,"default",{value:s,enumerable:!0}):t,s)),Xs=s=>tn(Oe({},"__esModule",{value:!0}),s);var W=H((ea,rn)=>{"use strict";var nn=["nodebuffer","arraybuffer","fragments"],sn=typeof Blob<"u";sn&&nn.push("blob");rn.exports={BINARY_TYPES:nn,CLOSE_TIMEOUT:3e4,EMPTY_BUFFER:Buffer.alloc(0),GUID:"258EAFA5-E914-47DA-95CA-C5AB0DC85B11",hasBlob:sn,kForOnEventAttribute:Symbol("kIsForOnEventAttribute"),kListener:Symbol("kListener"),kStatusCode:Symbol("status-code"),kWebSocket:Symbol("websocket"),NOOP:()=>{}}});var Ee=H((ta,Ne)=>{"use strict";var{EMPTY_BUFFER:Ys}=W(),ht=Buffer[Symbol.species];function Zs(s,e){if(s.length===0)return Ys;if(s.length===1)return s[0];let t=Buffer.allocUnsafe(e),n=0;for(let i=0;i<s.length;i++){let r=s[i];t.set(r,n),n+=r.length}return n<e?new ht(t.buffer,t.byteOffset,n):t}function on(s,e,t,n,i){for(let r=0;r<i;r++)t[n+r]=s[r]^e[r&3]}function an(s,e){for(let t=0;t<s.length;t++)s[t]^=e[t&3]}function Qs(s){return s.length===s.buffer.byteLength?s.buffer:s.buffer.slice(s.byteOffset,s.byteOffset+s.length)}function pt(s){if(pt.readOnly=!0,Buffer.isBuffer(s))return s;let e;return s instanceof ArrayBuffer?e=new ht(s):ArrayBuffer.isView(s)?e=new ht(s.buffer,s.byteOffset,s.byteLength):(e=Buffer.from(s),pt.readOnly=!1),e}Ne.exports={concat:Zs,mask:on,toArrayBuffer:Qs,toBuffer:pt,unmask:an};if(!process.env.WS_NO_BUFFER_UTIL)try{let s=require("bufferutil");Ne.exports.mask=function(e,t,n,i,r){r<48?on(e,t,n,i,r):s.mask(e,t,n,i,r)},Ne.exports.unmask=function(e,t){e.length<32?an(e,t):s.unmask(e,t)}}catch{}});var dn=H((na,ln)=>{"use strict";var cn=Symbol("kDone"),mt=Symbol("kRun"),gt=class{constructor(e){this[cn]=()=>{this.pending--,this[mt]()},this.concurrency=e||1/0,this.jobs=[],this.pending=0}add(e){this.jobs.push(e),this[mt]()}[mt](){if(this.pending!==this.concurrency&&this.jobs.length){let e=this.jobs.shift();this.pending++,e(this[cn])}}};ln.exports=gt});var ue=H((sa,pn)=>{"use strict";var we=require("zlib"),un=Ee(),ei=dn(),{kStatusCode:fn}=W(),ti=Buffer[Symbol.species],ni=Buffer.from([0,0,255,255]),Ie=Symbol("permessage-deflate"),j=Symbol("total-length"),le=Symbol("callback"),K=Symbol("buffers"),de=Symbol("error"),Fe,yt=class{constructor(e){if(this._options=e||{},this._threshold=this._options.threshold!==void 0?this._options.threshold:1024,this._maxPayload=this._options.maxPayload|0,this._isServer=!!this._options.isServer,this._deflate=null,this._inflate=null,this.params=null,!Fe){let t=this._options.concurrencyLimit!==void 0?this._options.concurrencyLimit:10;Fe=new ei(t)}}static get extensionName(){return"permessage-deflate"}offer(){let e={};return this._options.serverNoContextTakeover&&(e.server_no_context_takeover=!0),this._options.clientNoContextTakeover&&(e.client_no_context_takeover=!0),this._options.serverMaxWindowBits&&(e.server_max_window_bits=this._options.serverMaxWindowBits),this._options.clientMaxWindowBits?e.client_max_window_bits=this._options.clientMaxWindowBits:this._options.clientMaxWindowBits==null&&(e.client_max_window_bits=!0),e}accept(e){return e=this.normalizeParams(e),this.params=this._isServer?this.acceptAsServer(e):this.acceptAsClient(e),this.params}cleanup(){if(this._inflate&&(this._inflate.close(),this._inflate=null),this._deflate){let e=this._deflate[le];this._deflate.close(),this._deflate=null,e&&e(new Error("The deflate stream was closed while data was being processed"))}}acceptAsServer(e){let t=this._options,n=e.find(i=>!(t.serverNoContextTakeover===!1&&i.server_no_context_takeover||i.server_max_window_bits&&(t.serverMaxWindowBits===!1||typeof t.serverMaxWindowBits=="number"&&t.serverMaxWindowBits>i.server_max_window_bits)||typeof t.clientMaxWindowBits=="number"&&!i.client_max_window_bits));if(!n)throw new Error("None of the extension offers can be accepted");return t.serverNoContextTakeover&&(n.server_no_context_takeover=!0),t.clientNoContextTakeover&&(n.client_no_context_takeover=!0),typeof t.serverMaxWindowBits=="number"&&(n.server_max_window_bits=t.serverMaxWindowBits),typeof t.clientMaxWindowBits=="number"?n.client_max_window_bits=t.clientMaxWindowBits:(n.client_max_window_bits===!0||t.clientMaxWindowBits===!1)&&delete n.client_max_window_bits,n}acceptAsClient(e){let t=e[0];if(this._options.clientNoContextTakeover===!1&&t.client_no_context_takeover)throw new Error('Unexpected parameter "client_no_context_takeover"');if(!t.client_max_window_bits)typeof this._options.clientMaxWindowBits=="number"&&(t.client_max_window_bits=this._options.clientMaxWindowBits);else if(this._options.clientMaxWindowBits===!1||typeof this._options.clientMaxWindowBits=="number"&&t.client_max_window_bits>this._options.clientMaxWindowBits)throw new Error('Unexpected or invalid parameter "client_max_window_bits"');return t}normalizeParams(e){return e.forEach(t=>{Object.keys(t).forEach(n=>{let i=t[n];if(i.length>1)throw new Error(`Parameter "${n}" must have only a single value`);if(i=i[0],n==="client_max_window_bits"){if(i!==!0){let r=+i;if(!Number.isInteger(r)||r<8||r>15)throw new TypeError(`Invalid value for parameter "${n}": ${i}`);i=r}else if(!this._isServer)throw new TypeError(`Invalid value for parameter "${n}": ${i}`)}else if(n==="server_max_window_bits"){let r=+i;if(!Number.isInteger(r)||r<8||r>15)throw new TypeError(`Invalid value for parameter "${n}": ${i}`);i=r}else if(n==="client_no_context_takeover"||n==="server_no_context_takeover"){if(i!==!0)throw new TypeError(`Invalid value for parameter "${n}": ${i}`)}else throw new Error(`Unknown parameter "${n}"`);t[n]=i})}),e}decompress(e,t,n){Fe.add(i=>{this._decompress(e,t,(r,o)=>{i(),n(r,o)})})}compress(e,t,n){Fe.add(i=>{this._compress(e,t,(r,o)=>{i(),n(r,o)})})}_decompress(e,t,n){let i=this._isServer?"client":"server";if(!this._inflate){let r=`${i}_max_window_bits`,o=typeof this.params[r]!="number"?we.Z_DEFAULT_WINDOWBITS:this.params[r];this._inflate=we.createInflateRaw({...this._options.zlibInflateOptions,windowBits:o}),this._inflate[Ie]=this,this._inflate[j]=0,this._inflate[K]=[],this._inflate.on("error",ii),this._inflate.on("data",hn)}this._inflate[le]=n,this._inflate.write(e),t&&this._inflate.write(ni),this._inflate.flush(()=>{let r=this._inflate[de];if(r){this._inflate.close(),this._inflate=null,n(r);return}let o=un.concat(this._inflate[K],this._inflate[j]);this._inflate._readableState.endEmitted?(this._inflate.close(),this._inflate=null):(this._inflate[j]=0,this._inflate[K]=[],t&&this.params[`${i}_no_context_takeover`]&&this._inflate.reset()),n(null,o)})}_compress(e,t,n){let i=this._isServer?"server":"client";if(!this._deflate){let r=`${i}_max_window_bits`,o=typeof this.params[r]!="number"?we.Z_DEFAULT_WINDOWBITS:this.params[r];this._deflate=we.createDeflateRaw({...this._options.zlibDeflateOptions,windowBits:o}),this._deflate[j]=0,this._deflate[K]=[],this._deflate.on("data",si)}this._deflate[le]=n,this._deflate.write(e),this._deflate.flush(we.Z_SYNC_FLUSH,()=>{if(!this._deflate)return;let r=un.concat(this._deflate[K],this._deflate[j]);t&&(r=new ti(r.buffer,r.byteOffset,r.length-4)),this._deflate[le]=null,this._deflate[j]=0,this._deflate[K]=[],t&&this.params[`${i}_no_context_takeover`]&&this._deflate.reset(),n(null,r)})}};pn.exports=yt;function si(s){this[K].push(s),this[j]+=s.length}function hn(s){if(this[j]+=s.length,this[Ie]._maxPayload<1||this[j]<=this[Ie]._maxPayload){this[K].push(s);return}this[de]=new RangeError("Max payload size exceeded"),this[de].code="WS_ERR_UNSUPPORTED_MESSAGE_LENGTH",this[de][fn]=1009,this.removeListener("data",hn),this.reset()}function ii(s){if(this[Ie]._inflate=null,this[de]){this[le](this[de]);return}s[fn]=1007,this[le](s)}});var fe=H((ia,Be)=>{"use strict";var{isUtf8:mn}=require("buffer"),{hasBlob:ri}=W(),oi=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,1,1,1,1,0,0,1,1,0,1,1,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,0,1,0];function ai(s){return s>=1e3&&s<=1014&&s!==1004&&s!==1005&&s!==1006||s>=3e3&&s<=4999}function bt(s){let e=s.length,t=0;for(;t<e;)if((s[t]&128)===0)t++;else if((s[t]&224)===192){if(t+1===e||(s[t+1]&192)!==128||(s[t]&254)===192)return!1;t+=2}else if((s[t]&240)===224){if(t+2>=e||(s[t+1]&192)!==128||(s[t+2]&192)!==128||s[t]===224&&(s[t+1]&224)===128||s[t]===237&&(s[t+1]&224)===160)return!1;t+=3}else if((s[t]&248)===240){if(t+3>=e||(s[t+1]&192)!==128||(s[t+2]&192)!==128||(s[t+3]&192)!==128||s[t]===240&&(s[t+1]&240)===128||s[t]===244&&s[t+1]>143||s[t]>244)return!1;t+=4}else return!1;return!0}function ci(s){return ri&&typeof s=="object"&&typeof s.arrayBuffer=="function"&&typeof s.type=="string"&&typeof s.stream=="function"&&(s[Symbol.toStringTag]==="Blob"||s[Symbol.toStringTag]==="File")}Be.exports={isBlob:ci,isValidStatusCode:ai,isValidUTF8:bt,tokenChars:oi};if(mn)Be.exports.isValidUTF8=function(s){return s.length<24?bt(s):mn(s)};else if(!process.env.WS_NO_UTF_8_VALIDATE)try{let s=require("utf-8-validate");Be.exports.isValidUTF8=function(e){return e.length<32?bt(e):s(e)}}catch{}});var St=H((ra,wn)=>{"use strict";var{Writable:li}=require("stream"),gn=ue(),{BINARY_TYPES:di,EMPTY_BUFFER:yn,kStatusCode:ui,kWebSocket:fi}=W(),{concat:Tt,toArrayBuffer:hi,unmask:pi}=Ee(),{isValidStatusCode:mi,isValidUTF8:bn}=fe(),$e=Buffer[Symbol.species],O=0,Tn=1,vn=2,En=3,vt=4,Et=5,Ue=6,wt=class extends li{constructor(e={}){super(),this._allowSynchronousEvents=e.allowSynchronousEvents!==void 0?e.allowSynchronousEvents:!0,this._binaryType=e.binaryType||di[0],this._extensions=e.extensions||{},this._isServer=!!e.isServer,this._maxBufferedChunks=e.maxBufferedChunks|0,this._maxFragments=e.maxFragments|0,this._maxPayload=e.maxPayload|0,this._skipUTF8Validation=!!e.skipUTF8Validation,this[fi]=void 0,this._bufferedBytes=0,this._buffers=[],this._compressed=!1,this._payloadLength=0,this._mask=void 0,this._fragmented=0,this._masked=!1,this._fin=!1,this._opcode=0,this._totalPayloadLength=0,this._messageLength=0,this._fragments=[],this._errored=!1,this._loop=!1,this._state=O}_write(e,t,n){if(this._opcode===8&&this._state==O)return n();if(this._maxBufferedChunks>0&&this._buffers.length>=this._maxBufferedChunks){n(this.createError(RangeError,"Too many buffered chunks",!1,1008,"WS_ERR_TOO_MANY_BUFFERED_PARTS"));return}this._bufferedBytes+=e.length,this._buffers.push(e),this.startLoop(n)}consume(e){if(this._bufferedBytes-=e,e===this._buffers[0].length)return this._buffers.shift();if(e<this._buffers[0].length){let n=this._buffers[0];return this._buffers[0]=new $e(n.buffer,n.byteOffset+e,n.length-e),new $e(n.buffer,n.byteOffset,e)}let t=Buffer.allocUnsafe(e);do{let n=this._buffers[0],i=t.length-e;e>=n.length?t.set(this._buffers.shift(),i):(t.set(new Uint8Array(n.buffer,n.byteOffset,e),i),this._buffers[0]=new $e(n.buffer,n.byteOffset+e,n.length-e)),e-=n.length}while(e>0);return t}startLoop(e){this._loop=!0;do switch(this._state){case O:this.getInfo(e);break;case Tn:this.getPayloadLength16(e);break;case vn:this.getPayloadLength64(e);break;case En:this.getMask();break;case vt:this.getData(e);break;case Et:case Ue:this._loop=!1;return}while(this._loop);this._errored||e()}getInfo(e){if(this._bufferedBytes<2){this._loop=!1;return}let t=this.consume(2);if((t[0]&48)!==0){let i=this.createError(RangeError,"RSV2 and RSV3 must be clear",!0,1002,"WS_ERR_UNEXPECTED_RSV_2_3");e(i);return}let n=(t[0]&64)===64;if(n&&!this._extensions[gn.extensionName]){let i=this.createError(RangeError,"RSV1 must be clear",!0,1002,"WS_ERR_UNEXPECTED_RSV_1");e(i);return}if(this._fin=(t[0]&128)===128,this._opcode=t[0]&15,this._payloadLength=t[1]&127,this._opcode===0){if(n){let i=this.createError(RangeError,"RSV1 must be clear",!0,1002,"WS_ERR_UNEXPECTED_RSV_1");e(i);return}if(!this._fragmented){let i=this.createError(RangeError,"invalid opcode 0",!0,1002,"WS_ERR_INVALID_OPCODE");e(i);return}this._opcode=this._fragmented}else if(this._opcode===1||this._opcode===2){if(this._fragmented){let i=this.createError(RangeError,`invalid opcode ${this._opcode}`,!0,1002,"WS_ERR_INVALID_OPCODE");e(i);return}this._compressed=n}else if(this._opcode>7&&this._opcode<11){if(!this._fin){let i=this.createError(RangeError,"FIN must be set",!0,1002,"WS_ERR_EXPECTED_FIN");e(i);return}if(n){let i=this.createError(RangeError,"RSV1 must be clear",!0,1002,"WS_ERR_UNEXPECTED_RSV_1");e(i);return}if(this._payloadLength>125||this._opcode===8&&this._payloadLength===1){let i=this.createError(RangeError,`invalid payload length ${this._payloadLength}`,!0,1002,"WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH");e(i);return}}else{let i=this.createError(RangeError,`invalid opcode ${this._opcode}`,!0,1002,"WS_ERR_INVALID_OPCODE");e(i);return}if(!this._fin&&!this._fragmented&&(this._fragmented=this._opcode),this._masked=(t[1]&128)===128,this._isServer){if(!this._masked){let i=this.createError(RangeError,"MASK must be set",!0,1002,"WS_ERR_EXPECTED_MASK");e(i);return}}else if(this._masked){let i=this.createError(RangeError,"MASK must be clear",!0,1002,"WS_ERR_UNEXPECTED_MASK");e(i);return}this._payloadLength===126?this._state=Tn:this._payloadLength===127?this._state=vn:this.haveLength(e)}getPayloadLength16(e){if(this._bufferedBytes<2){this._loop=!1;return}this._payloadLength=this.consume(2).readUInt16BE(0),this.haveLength(e)}getPayloadLength64(e){if(this._bufferedBytes<8){this._loop=!1;return}let t=this.consume(8),n=t.readUInt32BE(0);if(n>Math.pow(2,21)-1){let i=this.createError(RangeError,"Unsupported WebSocket frame: payload length > 2^53 - 1",!1,1009,"WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH");e(i);return}this._payloadLength=n*Math.pow(2,32)+t.readUInt32BE(4),this.haveLength(e)}haveLength(e){if(this._payloadLength&&this._opcode<8&&(this._totalPayloadLength+=this._payloadLength,this._totalPayloadLength>this._maxPayload&&this._maxPayload>0)){let t=this.createError(RangeError,"Max payload size exceeded",!1,1009,"WS_ERR_UNSUPPORTED_MESSAGE_LENGTH");e(t);return}this._masked?this._state=En:this._state=vt}getMask(){if(this._bufferedBytes<4){this._loop=!1;return}this._mask=this.consume(4),this._state=vt}getData(e){let t=yn;if(this._payloadLength){if(this._bufferedBytes<this._payloadLength){this._loop=!1;return}t=this.consume(this._payloadLength),this._masked&&(this._mask[0]|this._mask[1]|this._mask[2]|this._mask[3])!==0&&pi(t,this._mask)}if(this._opcode>7){this.controlMessage(t,e);return}if(this._compressed){this._state=Et,this.decompress(t,e);return}if(t.length){if(this._maxFragments>0&&this._fragments.length>=this._maxFragments){let n=this.createError(RangeError,"Too many message fragments",!1,1008,"WS_ERR_TOO_MANY_BUFFERED_PARTS");e(n);return}this._messageLength=this._totalPayloadLength,this._fragments.push(t)}this.dataMessage(e)}decompress(e,t){this._extensions[gn.extensionName].decompress(e,this._fin,(i,r)=>{if(i)return t(i);if(r.length){if(this._messageLength+=r.length,this._messageLength>this._maxPayload&&this._maxPayload>0){let o=this.createError(RangeError,"Max payload size exceeded",!1,1009,"WS_ERR_UNSUPPORTED_MESSAGE_LENGTH");t(o);return}if(this._maxFragments>0&&this._fragments.length>=this._maxFragments){let o=this.createError(RangeError,"Too many message fragments",!1,1008,"WS_ERR_TOO_MANY_BUFFERED_PARTS");t(o);return}this._fragments.push(r)}this.dataMessage(t),this._state===O&&this.startLoop(t)})}dataMessage(e){if(!this._fin){this._state=O;return}let t=this._messageLength,n=this._fragments;if(this._totalPayloadLength=0,this._messageLength=0,this._fragmented=0,this._fragments=[],this._opcode===2){let i;this._binaryType==="nodebuffer"?i=Tt(n,t):this._binaryType==="arraybuffer"?i=hi(Tt(n,t)):this._binaryType==="blob"?i=new Blob(n):i=n,this._allowSynchronousEvents?(this.emit("message",i,!0),this._state=O):(this._state=Ue,setImmediate(()=>{this.emit("message",i,!0),this._state=O,this.startLoop(e)}))}else{let i=Tt(n,t);if(!this._skipUTF8Validation&&!bn(i)){let r=this.createError(Error,"invalid UTF-8 sequence",!0,1007,"WS_ERR_INVALID_UTF8");e(r);return}this._state===Et||this._allowSynchronousEvents?(this.emit("message",i,!1),this._state=O):(this._state=Ue,setImmediate(()=>{this.emit("message",i,!1),this._state=O,this.startLoop(e)}))}}controlMessage(e,t){if(this._opcode===8){if(e.length===0)this._loop=!1,this.emit("conclude",1005,yn),this.end();else{let n=e.readUInt16BE(0);if(!mi(n)){let r=this.createError(RangeError,`invalid status code ${n}`,!0,1002,"WS_ERR_INVALID_CLOSE_CODE");t(r);return}let i=new $e(e.buffer,e.byteOffset+2,e.length-2);if(!this._skipUTF8Validation&&!bn(i)){let r=this.createError(Error,"invalid UTF-8 sequence",!0,1007,"WS_ERR_INVALID_UTF8");t(r);return}this._loop=!1,this.emit("conclude",n,i),this.end()}this._state=O;return}this._allowSynchronousEvents?(this.emit(this._opcode===9?"ping":"pong",e),this._state=O):(this._state=Ue,setImmediate(()=>{this.emit(this._opcode===9?"ping":"pong",e),this._state=O,this.startLoop(t)}))}createError(e,t,n,i,r){this._loop=!1,this._errored=!0;let o=new e(n?`Invalid WebSocket frame: ${t}`:t);return Error.captureStackTrace(o,this.createError),o.code=r,o[ui]=i,o}};wn.exports=wt});var Mt=H((aa,_n)=>{"use strict";var{Duplex:oa}=require("stream"),{randomFillSync:gi}=require("crypto"),{types:{isUint8Array:yi}}=require("util"),Sn=ue(),{EMPTY_BUFFER:bi,kWebSocket:Ti,NOOP:vi}=W(),{isBlob:he,isValidStatusCode:Ei}=fe(),{mask:xn,toBuffer:Q}=Ee(),N=Symbol("kByteLength"),wi=Buffer.alloc(4),We=8*1024,ee,pe=We,$=0,Si=1,xi=2,xt=class s{constructor(e,t,n){this._extensions=t||{},n&&(this._generateMask=n,this._maskBuffer=Buffer.alloc(4)),this._socket=e,this._firstFragment=!0,this._compress=!1,this._bufferedBytes=0,this._queue=[],this._state=$,this.onerror=vi,this[Ti]=void 0}static frame(e,t){let n,i=!1,r=2,o=!1;t.mask&&(n=t.maskBuffer||wi,t.generateMask?t.generateMask(n):(pe===We&&(ee===void 0&&(ee=Buffer.alloc(We)),gi(ee,0,We),pe=0),n[0]=ee[pe++],n[1]=ee[pe++],n[2]=ee[pe++],n[3]=ee[pe++]),o=(n[0]|n[1]|n[2]|n[3])===0,r=6);let a;typeof e=="string"?(!t.mask||o)&&t[N]!==void 0?a=t[N]:(e=Buffer.from(e),a=e.length):(a=e.length,i=t.mask&&t.readOnly&&!o);let l=a;a>=65536?(r+=8,l=127):a>125&&(r+=2,l=126);let c=Buffer.allocUnsafe(i?a+r:r);return c[0]=t.fin?t.opcode|128:t.opcode,t.rsv1&&(c[0]|=64),c[1]=l,l===126?c.writeUInt16BE(a,2):l===127&&(c[2]=c[3]=0,c.writeUIntBE(a,4,6)),t.mask?(c[1]|=128,c[r-4]=n[0],c[r-3]=n[1],c[r-2]=n[2],c[r-1]=n[3],o?[c,e]:i?(xn(e,n,c,r,a),[c]):(xn(e,n,e,0,a),[c,e])):[c,e]}close(e,t,n,i){let r;if(e===void 0)r=bi;else{if(typeof e!="number"||!Ei(e))throw new TypeError("First argument must be a valid error code number");if(t===void 0||!t.length)r=Buffer.allocUnsafe(2),r.writeUInt16BE(e,0);else{let a=Buffer.byteLength(t);if(a>123)throw new RangeError("The message must not be greater than 123 bytes");if(r=Buffer.allocUnsafe(2+a),r.writeUInt16BE(e,0),typeof t=="string")r.write(t,2);else if(yi(t))r.set(t,2);else throw new TypeError("Second argument must be a string or a Uint8Array")}}let o={[N]:r.length,fin:!0,generateMask:this._generateMask,mask:n,maskBuffer:this._maskBuffer,opcode:8,readOnly:!1,rsv1:!1};this._state!==$?this.enqueue([this.dispatch,r,!1,o,i]):this.sendFrame(s.frame(r,o),i)}ping(e,t,n){let i,r;if(typeof e=="string"?(i=Buffer.byteLength(e),r=!1):he(e)?(i=e.size,r=!1):(e=Q(e),i=e.length,r=Q.readOnly),i>125)throw new RangeError("The data size must not be greater than 125 bytes");let o={[N]:i,fin:!0,generateMask:this._generateMask,mask:t,maskBuffer:this._maskBuffer,opcode:9,readOnly:r,rsv1:!1};he(e)?this._state!==$?this.enqueue([this.getBlobData,e,!1,o,n]):this.getBlobData(e,!1,o,n):this._state!==$?this.enqueue([this.dispatch,e,!1,o,n]):this.sendFrame(s.frame(e,o),n)}pong(e,t,n){let i,r;if(typeof e=="string"?(i=Buffer.byteLength(e),r=!1):he(e)?(i=e.size,r=!1):(e=Q(e),i=e.length,r=Q.readOnly),i>125)throw new RangeError("The data size must not be greater than 125 bytes");let o={[N]:i,fin:!0,generateMask:this._generateMask,mask:t,maskBuffer:this._maskBuffer,opcode:10,readOnly:r,rsv1:!1};he(e)?this._state!==$?this.enqueue([this.getBlobData,e,!1,o,n]):this.getBlobData(e,!1,o,n):this._state!==$?this.enqueue([this.dispatch,e,!1,o,n]):this.sendFrame(s.frame(e,o),n)}send(e,t,n){let i=this._extensions[Sn.extensionName],r=t.binary?2:1,o=t.compress,a,l;typeof e=="string"?(a=Buffer.byteLength(e),l=!1):he(e)?(a=e.size,l=!1):(e=Q(e),a=e.length,l=Q.readOnly),this._firstFragment?(this._firstFragment=!1,o&&i&&i.params[i._isServer?"server_no_context_takeover":"client_no_context_takeover"]&&(o=a>=i._threshold),this._compress=o):(o=!1,r=0),t.fin&&(this._firstFragment=!0);let c={[N]:a,fin:t.fin,generateMask:this._generateMask,mask:t.mask,maskBuffer:this._maskBuffer,opcode:r,readOnly:l,rsv1:o};he(e)?this._state!==$?this.enqueue([this.getBlobData,e,this._compress,c,n]):this.getBlobData(e,this._compress,c,n):this._state!==$?this.enqueue([this.dispatch,e,this._compress,c,n]):this.dispatch(e,this._compress,c,n)}getBlobData(e,t,n,i){this._bufferedBytes+=n[N],this._state=xi,e.arrayBuffer().then(r=>{if(this._socket.destroyed){let a=new Error("The socket was closed while the blob was being read");process.nextTick(_t,this,a,i);return}this._bufferedBytes-=n[N];let o=Q(r);t?this.dispatch(o,t,n,i):(this._state=$,this.sendFrame(s.frame(o,n),i),this.dequeue())}).catch(r=>{process.nextTick(_i,this,r,i)})}dispatch(e,t,n,i){if(!t){this.sendFrame(s.frame(e,n),i);return}let r=this._extensions[Sn.extensionName];this._bufferedBytes+=n[N],this._state=Si,r.compress(e,n.fin,(o,a)=>{if(this._socket.destroyed){let l=new Error("The socket was closed while data was being compressed");_t(this,l,i);return}this._bufferedBytes-=n[N],this._state=$,n.readOnly=!1,this.sendFrame(s.frame(a,n),i),this.dequeue()})}dequeue(){for(;this._state===$&&this._queue.length;){let e=this._queue.shift();this._bufferedBytes-=e[3][N],Reflect.apply(e[0],this,e.slice(1))}}enqueue(e){this._bufferedBytes+=e[3][N],this._queue.push(e)}sendFrame(e,t){e.length===2?(this._socket.cork(),this._socket.write(e[0]),this._socket.write(e[1],t),this._socket.uncork()):this._socket.write(e[0],t)}};_n.exports=xt;function _t(s,e,t){typeof t=="function"&&t(e);for(let n=0;n<s._queue.length;n++){let i=s._queue[n],r=i[i.length-1];typeof r=="function"&&r(e)}}function _i(s,e,t){_t(s,e,t),s.onerror(e)}});var Dn=H((ca,Hn)=>{"use strict";var{kForOnEventAttribute:Se,kListener:Rt}=W(),Mn=Symbol("kCode"),Rn=Symbol("kData"),Ln=Symbol("kError"),Cn=Symbol("kMessage"),Pn=Symbol("kReason"),me=Symbol("kTarget"),An=Symbol("kType"),kn=Symbol("kWasClean"),q=class{constructor(e){this[me]=null,this[An]=e}get target(){return this[me]}get type(){return this[An]}};Object.defineProperty(q.prototype,"target",{enumerable:!0});Object.defineProperty(q.prototype,"type",{enumerable:!0});var te=class extends q{constructor(e,t={}){super(e),this[Mn]=t.code===void 0?0:t.code,this[Pn]=t.reason===void 0?"":t.reason,this[kn]=t.wasClean===void 0?!1:t.wasClean}get code(){return this[Mn]}get reason(){return this[Pn]}get wasClean(){return this[kn]}};Object.defineProperty(te.prototype,"code",{enumerable:!0});Object.defineProperty(te.prototype,"reason",{enumerable:!0});Object.defineProperty(te.prototype,"wasClean",{enumerable:!0});var ge=class extends q{constructor(e,t={}){super(e),this[Ln]=t.error===void 0?null:t.error,this[Cn]=t.message===void 0?"":t.message}get error(){return this[Ln]}get message(){return this[Cn]}};Object.defineProperty(ge.prototype,"error",{enumerable:!0});Object.defineProperty(ge.prototype,"message",{enumerable:!0});var xe=class extends q{constructor(e,t={}){super(e),this[Rn]=t.data===void 0?null:t.data}get data(){return this[Rn]}};Object.defineProperty(xe.prototype,"data",{enumerable:!0});var Mi={addEventListener(s,e,t={}){for(let i of this.listeners(s))if(!t[Se]&&i[Rt]===e&&!i[Se])return;let n;if(s==="message")n=function(r,o){let a=new xe("message",{data:o?r:r.toString()});a[me]=this,je(e,this,a)};else if(s==="close")n=function(r,o){let a=new te("close",{code:r,reason:o.toString(),wasClean:this._closeFrameReceived&&this._closeFrameSent});a[me]=this,je(e,this,a)};else if(s==="error")n=function(r){let o=new ge("error",{error:r,message:r.message});o[me]=this,je(e,this,o)};else if(s==="open")n=function(){let r=new q("open");r[me]=this,je(e,this,r)};else return;n[Se]=!!t[Se],n[Rt]=e,t.once?this.once(s,n):this.on(s,n)},removeEventListener(s,e){for(let t of this.listeners(s))if(t[Rt]===e&&!t[Se]){this.removeListener(s,t);break}}};Hn.exports={CloseEvent:te,ErrorEvent:ge,Event:q,EventTarget:Mi,MessageEvent:xe};function je(s,e,t){typeof s=="object"&&s.handleEvent?s.handleEvent.call(s,t):s.call(e,t)}});var qe=H((la,On)=>{"use strict";var{tokenChars:_e}=fe();function U(s,e,t){s[e]===void 0?s[e]=[t]:s[e].push(t)}function Ri(s){let e=Object.create(null),t=Object.create(null),n=!1,i=!1,r=!1,o,a,l=-1,c=-1,u=-1,d=0;for(;d<s.length;d++)if(c=s.charCodeAt(d),o===void 0)if(u===-1&&_e[c]===1)l===-1&&(l=d);else if(d!==0&&(c===32||c===9))u===-1&&l!==-1&&(u=d);else if(c===59||c===44){if(l===-1)throw new SyntaxError(`Unexpected character at index ${d}`);u===-1&&(u=d);let p=s.slice(l,u);c===44?(U(e,p,t),t=Object.create(null)):o=p,l=u=-1}else throw new SyntaxError(`Unexpected character at index ${d}`);else if(a===void 0)if(u===-1&&_e[c]===1)l===-1&&(l=d);else if(c===32||c===9)u===-1&&l!==-1&&(u=d);else if(c===59||c===44){if(l===-1)throw new SyntaxError(`Unexpected character at index ${d}`);u===-1&&(u=d),U(t,s.slice(l,u),!0),c===44&&(U(e,o,t),t=Object.create(null),o=void 0),l=u=-1}else if(c===61&&l!==-1&&u===-1)a=s.slice(l,d),l=u=-1;else throw new SyntaxError(`Unexpected character at index ${d}`);else if(i){if(_e[c]!==1)throw new SyntaxError(`Unexpected character at index ${d}`);l===-1?l=d:n||(n=!0),i=!1}else if(r)if(_e[c]===1)l===-1&&(l=d);else if(c===34&&l!==-1)r=!1,u=d;else if(c===92)i=!0;else throw new SyntaxError(`Unexpected character at index ${d}`);else if(c===34&&s.charCodeAt(d-1)===61)r=!0;else if(u===-1&&_e[c]===1)l===-1&&(l=d);else if(l!==-1&&(c===32||c===9))u===-1&&(u=d);else if(c===59||c===44){if(l===-1)throw new SyntaxError(`Unexpected character at index ${d}`);u===-1&&(u=d);let p=s.slice(l,u);n&&(p=p.replace(/\\/g,""),n=!1),U(t,a,p),c===44&&(U(e,o,t),t=Object.create(null),o=void 0),a=void 0,l=u=-1}else throw new SyntaxError(`Unexpected character at index ${d}`);if(l===-1||r||c===32||c===9)throw new SyntaxError("Unexpected end of input");u===-1&&(u=d);let f=s.slice(l,u);return o===void 0?U(e,f,t):(a===void 0?U(t,f,!0):n?U(t,a,f.replace(/\\/g,"")):U(t,a,f),U(e,o,t)),e}function Li(s){return Object.keys(s).map(e=>{let t=s[e];return Array.isArray(t)||(t=[t]),t.map(n=>[e].concat(Object.keys(n).map(i=>{let r=n[i];return Array.isArray(r)||(r=[r]),r.map(o=>o===!0?i:`${i}=${o}`).join("; ")})).join("; ")).join(", ")}).join(", ")}On.exports={format:Li,parse:Ri}});var Je=H((fa,Vn)=>{"use strict";var Ci=require("events"),Pi=require("https"),Ai=require("http"),In=require("net"),ki=require("tls"),{randomBytes:Hi,createHash:Di}=require("crypto"),{Duplex:da,Readable:ua}=require("stream"),{URL:Lt}=require("url"),X=ue(),Oi=St(),Ni=Mt(),{isBlob:Fi}=fe(),{BINARY_TYPES:Nn,CLOSE_TIMEOUT:Ii,EMPTY_BUFFER:Ge,GUID:Bi,kForOnEventAttribute:Ct,kListener:$i,kStatusCode:Ui,kWebSocket:x,NOOP:Bn}=W(),{EventTarget:{addEventListener:Wi,removeEventListener:ji}}=Dn(),{format:qi,parse:Gi}=qe(),{toBuffer:zi}=Ee(),$n=Symbol("kAborted"),Pt=[8,13],G=["CONNECTING","OPEN","CLOSING","CLOSED"],Vi=/^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/,E=class s extends Ci{constructor(e,t,n){super(),this._binaryType=Nn[0],this._closeCode=1006,this._closeFrameReceived=!1,this._closeFrameSent=!1,this._closeMessage=Ge,this._closeTimer=null,this._errorEmitted=!1,this._extensions={},this._paused=!1,this._protocol="",this._readyState=s.CONNECTING,this._receiver=null,this._sender=null,this._socket=null,e!==null?(this._bufferedAmount=0,this._isServer=!1,this._redirects=0,t===void 0?t=[]:Array.isArray(t)||(typeof t=="object"&&t!==null?(n=t,t=[]):t=[t]),Un(this,e,t,n)):(this._autoPong=n.autoPong,this._closeTimeout=n.closeTimeout,this._isServer=!0)}get binaryType(){return this._binaryType}set binaryType(e){Nn.includes(e)&&(this._binaryType=e,this._receiver&&(this._receiver._binaryType=e))}get bufferedAmount(){return this._socket?this._socket._writableState.length+this._sender._bufferedBytes:this._bufferedAmount}get extensions(){return Object.keys(this._extensions).join()}get isPaused(){return this._paused}get onclose(){return null}get onerror(){return null}get onopen(){return null}get onmessage(){return null}get protocol(){return this._protocol}get readyState(){return this._readyState}get url(){return this._url}setSocket(e,t,n){let i=new Oi({allowSynchronousEvents:n.allowSynchronousEvents,binaryType:this.binaryType,extensions:this._extensions,isServer:this._isServer,maxBufferedChunks:n.maxBufferedChunks,maxFragments:n.maxFragments,maxPayload:n.maxPayload,skipUTF8Validation:n.skipUTF8Validation}),r=new Ni(e,this._extensions,n.generateMask);this._receiver=i,this._sender=r,this._socket=e,i[x]=this,r[x]=this,e[x]=this,i.on("conclude",Xi),i.on("drain",Yi),i.on("error",Zi),i.on("message",Qi),i.on("ping",er),i.on("pong",tr),r.onerror=nr,e.setTimeout&&e.setTimeout(0),e.setNoDelay&&e.setNoDelay(),t.length>0&&e.unshift(t),e.on("close",qn),e.on("data",Ve),e.on("end",Gn),e.on("error",zn),this._readyState=s.OPEN,this.emit("open")}emitClose(){if(!this._socket){this._readyState=s.CLOSED,this.emit("close",this._closeCode,this._closeMessage);return}this._extensions[X.extensionName]&&this._extensions[X.extensionName].cleanup(),this._receiver.removeAllListeners(),this._readyState=s.CLOSED,this.emit("close",this._closeCode,this._closeMessage)}close(e,t){if(this.readyState!==s.CLOSED){if(this.readyState===s.CONNECTING){D(this,this._req,"WebSocket was closed before the connection was established");return}if(this.readyState===s.CLOSING){this._closeFrameSent&&(this._closeFrameReceived||this._receiver._writableState.errorEmitted)&&this._socket.end();return}this._readyState=s.CLOSING,this._sender.close(e,t,!this._isServer,n=>{n||(this._closeFrameSent=!0,(this._closeFrameReceived||this._receiver._writableState.errorEmitted)&&this._socket.end())}),jn(this)}}pause(){this.readyState===s.CONNECTING||this.readyState===s.CLOSED||(this._paused=!0,this._socket.pause())}ping(e,t,n){if(this.readyState===s.CONNECTING)throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");if(typeof e=="function"?(n=e,e=t=void 0):typeof t=="function"&&(n=t,t=void 0),typeof e=="number"&&(e=e.toString()),this.readyState!==s.OPEN){At(this,e,n);return}t===void 0&&(t=!this._isServer),this._sender.ping(e||Ge,t,n)}pong(e,t,n){if(this.readyState===s.CONNECTING)throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");if(typeof e=="function"?(n=e,e=t=void 0):typeof t=="function"&&(n=t,t=void 0),typeof e=="number"&&(e=e.toString()),this.readyState!==s.OPEN){At(this,e,n);return}t===void 0&&(t=!this._isServer),this._sender.pong(e||Ge,t,n)}resume(){this.readyState===s.CONNECTING||this.readyState===s.CLOSED||(this._paused=!1,this._receiver._writableState.needDrain||this._socket.resume())}send(e,t,n){if(this.readyState===s.CONNECTING)throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");if(typeof t=="function"&&(n=t,t={}),typeof e=="number"&&(e=e.toString()),this.readyState!==s.OPEN){At(this,e,n);return}let i={binary:typeof e!="string",mask:!this._isServer,compress:!0,fin:!0,...t};this._extensions[X.extensionName]||(i.compress=!1),this._sender.send(e||Ge,i,n)}terminate(){if(this.readyState!==s.CLOSED){if(this.readyState===s.CONNECTING){D(this,this._req,"WebSocket was closed before the connection was established");return}this._socket&&(this._readyState=s.CLOSING,this._socket.destroy())}}};Object.defineProperty(E,"CONNECTING",{enumerable:!0,value:G.indexOf("CONNECTING")});Object.defineProperty(E.prototype,"CONNECTING",{enumerable:!0,value:G.indexOf("CONNECTING")});Object.defineProperty(E,"OPEN",{enumerable:!0,value:G.indexOf("OPEN")});Object.defineProperty(E.prototype,"OPEN",{enumerable:!0,value:G.indexOf("OPEN")});Object.defineProperty(E,"CLOSING",{enumerable:!0,value:G.indexOf("CLOSING")});Object.defineProperty(E.prototype,"CLOSING",{enumerable:!0,value:G.indexOf("CLOSING")});Object.defineProperty(E,"CLOSED",{enumerable:!0,value:G.indexOf("CLOSED")});Object.defineProperty(E.prototype,"CLOSED",{enumerable:!0,value:G.indexOf("CLOSED")});["binaryType","bufferedAmount","extensions","isPaused","protocol","readyState","url"].forEach(s=>{Object.defineProperty(E.prototype,s,{enumerable:!0})});["open","error","close","message"].forEach(s=>{Object.defineProperty(E.prototype,`on${s}`,{enumerable:!0,get(){for(let e of this.listeners(s))if(e[Ct])return e[$i];return null},set(e){for(let t of this.listeners(s))if(t[Ct]){this.removeListener(s,t);break}typeof e=="function"&&this.addEventListener(s,e,{[Ct]:!0})}})});E.prototype.addEventListener=Wi;E.prototype.removeEventListener=ji;Vn.exports=E;function Un(s,e,t,n){let i={allowSynchronousEvents:!0,autoPong:!0,closeTimeout:Ii,protocolVersion:Pt[1],maxBufferedChunks:1048576,maxFragments:131072,maxPayload:104857600,skipUTF8Validation:!1,perMessageDeflate:!0,followRedirects:!1,maxRedirects:10,...n,socketPath:void 0,hostname:void 0,protocol:void 0,timeout:void 0,method:"GET",host:void 0,path:void 0,port:void 0};if(s._autoPong=i.autoPong,s._closeTimeout=i.closeTimeout,!Pt.includes(i.protocolVersion))throw new RangeError(`Unsupported protocol version: ${i.protocolVersion} (supported versions: ${Pt.join(", ")})`);let r;if(e instanceof Lt)r=e;else try{r=new Lt(e)}catch{throw new SyntaxError(`Invalid URL: ${e}`)}r.protocol==="http:"?r.protocol="ws:":r.protocol==="https:"&&(r.protocol="wss:"),s._url=r.href;let o=r.protocol==="wss:",a=r.protocol==="ws+unix:",l;if(r.protocol!=="ws:"&&!o&&!a?l=`The URL's protocol must be one of "ws:", "wss:", "http:", "https:", or "ws+unix:"`:a&&!r.pathname?l="The URL's pathname is empty":r.hash&&(l="The URL contains a fragment identifier"),l){let h=new SyntaxError(l);if(s._redirects===0)throw h;ze(s,h);return}let c=o?443:80,u=Hi(16).toString("base64"),d=o?Pi.request:Ai.request,f=new Set,p;if(i.createConnection=i.createConnection||(o?Ki:Ji),i.defaultPort=i.defaultPort||c,i.port=r.port||c,i.host=r.hostname.startsWith("[")?r.hostname.slice(1,-1):r.hostname,i.headers={...i.headers,"Sec-WebSocket-Version":i.protocolVersion,"Sec-WebSocket-Key":u,Connection:"Upgrade",Upgrade:"websocket"},i.path=r.pathname+r.search,i.timeout=i.handshakeTimeout,i.perMessageDeflate&&(p=new X({...i.perMessageDeflate,isServer:!1,maxPayload:i.maxPayload}),i.headers["Sec-WebSocket-Extensions"]=qi({[X.extensionName]:p.offer()})),t.length){for(let h of t){if(typeof h!="string"||!Vi.test(h)||f.has(h))throw new SyntaxError("An invalid or duplicated subprotocol was specified");f.add(h)}i.headers["Sec-WebSocket-Protocol"]=t.join(",")}if(i.origin&&(i.protocolVersion<13?i.headers["Sec-WebSocket-Origin"]=i.origin:i.headers.Origin=i.origin),(r.username||r.password)&&(i.auth=`${r.username}:${r.password}`),a){let h=i.path.split(":");i.socketPath=h[0],i.path=h[1]}let m;if(i.followRedirects){if(s._redirects===0){s._originalIpc=a,s._originalSecure=o,s._originalHostOrSocketPath=a?i.socketPath:r.host;let h=n&&n.headers;if(n={...n,headers:{}},h)for(let[y,T]of Object.entries(h))n.headers[y.toLowerCase()]=T}else if(s.listenerCount("redirect")===0){let h=a?s._originalIpc?i.socketPath===s._originalHostOrSocketPath:!1:s._originalIpc?!1:r.host===s._originalHostOrSocketPath;(!h||s._originalSecure&&!o)&&(delete i.headers.authorization,delete i.headers.cookie,h||delete i.headers.host,i.auth=void 0)}i.auth&&!n.headers.authorization&&(n.headers.authorization="Basic "+Buffer.from(i.auth).toString("base64")),m=s._req=d(i),s._redirects&&s.emit("redirect",s.url,m)}else m=s._req=d(i);i.timeout&&m.on("timeout",()=>{D(s,m,"Opening handshake has timed out")}),m.on("error",h=>{m===null||m[$n]||(m=s._req=null,ze(s,h))}),m.on("response",h=>{let y=h.headers.location,T=h.statusCode;if(y&&i.followRedirects&&T>=300&&T<400){if(++s._redirects>i.maxRedirects){D(s,m,"Maximum redirects exceeded");return}m.abort();let v;try{v=new Lt(y,e)}catch{let M=new SyntaxError(`Invalid URL: ${y}`);ze(s,M);return}Un(s,v,t,n)}else s.emit("unexpected-response",m,h)||D(s,m,`Unexpected server response: ${h.statusCode}`)}),m.on("upgrade",(h,y,T)=>{if(s.emit("upgrade",h),s.readyState!==E.CONNECTING)return;m=s._req=null;let v=h.headers.upgrade;if(v===void 0||v.toLowerCase()!=="websocket"){D(s,y,"Invalid Upgrade header");return}let k=Di("sha1").update(u+Bi).digest("base64");if(h.headers["sec-websocket-accept"]!==k){D(s,y,"Invalid Sec-WebSocket-Accept header");return}let M=h.headers["sec-websocket-protocol"],R;if(M!==void 0?f.size?f.has(M)||(R="Server sent an invalid subprotocol"):R="Server sent a subprotocol but none was requested":f.size&&(R="Server sent no subprotocol"),R){D(s,y,R);return}M&&(s._protocol=M);let ve=h.headers["sec-websocket-extensions"];if(ve!==void 0){if(!p){D(s,y,"Server sent a Sec-WebSocket-Extensions header but no extension was requested");return}let ce;try{ce=Gi(ve)}catch{D(s,y,"Invalid Sec-WebSocket-Extensions header");return}let en=Object.keys(ce);if(en.length!==1||en[0]!==X.extensionName){D(s,y,"Server indicated an extension that was not requested");return}try{p.accept(ce[X.extensionName])}catch{D(s,y,"Invalid Sec-WebSocket-Extensions header");return}s._extensions[X.extensionName]=p}s.setSocket(y,T,{allowSynchronousEvents:i.allowSynchronousEvents,generateMask:i.generateMask,maxBufferedChunks:i.maxBufferedChunks,maxFragments:i.maxFragments,maxPayload:i.maxPayload,skipUTF8Validation:i.skipUTF8Validation})}),i.finishRequest?i.finishRequest(m,s):m.end()}function ze(s,e){s._readyState=E.CLOSING,s._errorEmitted=!0,s.emit("error",e),s.emitClose()}function Ji(s){return s.path=s.socketPath,In.connect(s)}function Ki(s){return s.path=void 0,!s.servername&&s.servername!==""&&(s.servername=In.isIP(s.host)?"":s.host),ki.connect(s)}function D(s,e,t){s._readyState=E.CLOSING;let n=new Error(t);Error.captureStackTrace(n,D),e.setHeader?(e[$n]=!0,e.abort(),e.socket&&!e.socket.destroyed&&e.socket.destroy(),process.nextTick(ze,s,n)):(e.destroy(n),e.once("error",s.emit.bind(s,"error")),e.once("close",s.emitClose.bind(s)))}function At(s,e,t){if(e){let n=Fi(e)?e.size:zi(e).length;s._socket?s._sender._bufferedBytes+=n:s._bufferedAmount+=n}if(t){let n=new Error(`WebSocket is not open: readyState ${s.readyState} (${G[s.readyState]})`);process.nextTick(t,n)}}function Xi(s,e){let t=this[x];t._closeFrameReceived=!0,t._closeMessage=e,t._closeCode=s,t._socket[x]!==void 0&&(t._socket.removeListener("data",Ve),process.nextTick(Wn,t._socket),s===1005?t.close():t.close(s,e))}function Yi(){let s=this[x];s.isPaused||s._socket.resume()}function Zi(s){let e=this[x];e._socket[x]!==void 0&&(e._socket.removeListener("data",Ve),process.nextTick(Wn,e._socket),e.close(s[Ui])),e._errorEmitted||(e._errorEmitted=!0,e.emit("error",s))}function Fn(){this[x].emitClose()}function Qi(s,e){this[x].emit("message",s,e)}function er(s){let e=this[x];e._autoPong&&e.pong(s,!this._isServer,Bn),e.emit("ping",s)}function tr(s){this[x].emit("pong",s)}function Wn(s){s.resume()}function nr(s){let e=this[x];e.readyState!==E.CLOSED&&(e.readyState===E.OPEN&&(e._readyState=E.CLOSING,jn(e)),this._socket.end(),e._errorEmitted||(e._errorEmitted=!0,e.emit("error",s)))}function jn(s){s._closeTimer=setTimeout(s._socket.destroy.bind(s._socket),s._closeTimeout)}function qn(){let s=this[x];if(this.removeListener("close",qn),this.removeListener("data",Ve),this.removeListener("end",Gn),s._readyState=E.CLOSING,!this._readableState.endEmitted&&!s._closeFrameReceived&&!s._receiver._writableState.errorEmitted&&this._readableState.length!==0){let e=this.read(this._readableState.length);s._receiver.write(e)}s._receiver.end(),this[x]=void 0,clearTimeout(s._closeTimer),s._receiver._writableState.finished||s._receiver._writableState.errorEmitted?s.emitClose():(s._receiver.on("error",Fn),s._receiver.on("finish",Fn))}function Ve(s){this[x]._receiver.write(s)||this.pause()}function Gn(){let s=this[x];s._readyState=E.CLOSING,s._receiver.end(),this.end()}function zn(){let s=this[x];this.removeListener("error",zn),this.on("error",Bn),s&&(s._readyState=E.CLOSING,this.destroy())}});var Yn=H((pa,Xn)=>{"use strict";var ha=Je(),{Duplex:sr}=require("stream");function Jn(s){s.emit("close")}function ir(){!this.destroyed&&this._writableState.finished&&this.destroy()}function Kn(s){this.removeListener("error",Kn),this.destroy(),this.listenerCount("error")===0&&this.emit("error",s)}function rr(s,e){let t=!0,n=new sr({...e,autoDestroy:!1,emitClose:!1,objectMode:!1,writableObjectMode:!1});return s.on("message",function(r,o){let a=!o&&n._readableState.objectMode?r.toString():r;n.push(a)||s.pause()}),s.once("error",function(r){n.destroyed||(t=!1,n.destroy(r))}),s.once("close",function(){n.destroyed||n.push(null)}),n._destroy=function(i,r){if(s.readyState===s.CLOSED){r(i),process.nextTick(Jn,n);return}let o=!1;s.once("error",function(l){o=!0,r(l)}),s.once("close",function(){o||r(i),process.nextTick(Jn,n)}),t&&s.terminate()},n._final=function(i){if(s.readyState===s.CONNECTING){s.once("open",function(){n._final(i)});return}s._socket!==null&&(s._socket._writableState.finished?(i(),n._readableState.endEmitted&&n.destroy()):(s._socket.once("finish",function(){i()}),s.close()))},n._read=function(){s.isPaused&&s.resume()},n._write=function(i,r,o){if(s.readyState===s.CONNECTING){s.once("open",function(){n._write(i,r,o)});return}s.send(i,o)},n.on("end",ir),n.on("error",Kn),n}Xn.exports=rr});var kt=H((ma,Zn)=>{"use strict";var{tokenChars:or}=fe();function ar(s){let e=new Set,t=-1,n=-1,i=0;for(i;i<s.length;i++){let o=s.charCodeAt(i);if(n===-1&&or[o]===1)t===-1&&(t=i);else if(i!==0&&(o===32||o===9))n===-1&&t!==-1&&(n=i);else if(o===44){if(t===-1)throw new SyntaxError(`Unexpected character at index ${i}`);n===-1&&(n=i);let a=s.slice(t,n);if(e.has(a))throw new SyntaxError(`The "${a}" subprotocol is duplicated`);e.add(a),t=n=-1}else throw new SyntaxError(`Unexpected character at index ${i}`)}if(t===-1||n!==-1)throw new SyntaxError("Unexpected end of input");let r=s.slice(t,i);if(e.has(r))throw new SyntaxError(`The "${r}" subprotocol is duplicated`);return e.add(r),e}Zn.exports={parse:ar}});var rs=H((ya,is)=>{"use strict";var cr=require("events"),Ke=require("http"),{Duplex:ga}=require("stream"),{createHash:lr}=require("crypto"),Qn=qe(),ne=ue(),dr=kt(),ur=Je(),{CLOSE_TIMEOUT:fr,GUID:hr,kWebSocket:pr}=W(),mr=/^[+/0-9A-Za-z]{22}==$/,es=0,ts=1,ss=2,Ht=class extends cr{constructor(e,t){if(super(),e={allowSynchronousEvents:!0,autoPong:!0,maxBufferedChunks:1024*1024,maxFragments:128*1024,maxPayload:100*1024*1024,skipUTF8Validation:!1,perMessageDeflate:!1,handleProtocols:null,clientTracking:!0,closeTimeout:fr,verifyClient:null,noServer:!1,backlog:null,server:null,host:null,path:null,port:null,WebSocket:ur,...e},e.port==null&&!e.server&&!e.noServer||e.port!=null&&(e.server||e.noServer)||e.server&&e.noServer)throw new TypeError('One and only one of the "port", "server", or "noServer" options must be specified');if(e.port!=null?(this._server=Ke.createServer((n,i)=>{let r=Ke.STATUS_CODES[426];i.writeHead(426,{"Content-Length":r.length,"Content-Type":"text/plain"}),i.end(r)}),this._server.listen(e.port,e.host,e.backlog,t)):e.server&&(this._server=e.server),this._server){let n=this.emit.bind(this,"connection");this._removeListeners=gr(this._server,{listening:this.emit.bind(this,"listening"),error:this.emit.bind(this,"error"),upgrade:(i,r,o)=>{this.handleUpgrade(i,r,o,n)}})}e.perMessageDeflate===!0&&(e.perMessageDeflate={}),e.clientTracking&&(this.clients=new Set,this._shouldEmitClose=!1),this.options=e,this._state=es}address(){if(this.options.noServer)throw new Error('The server is operating in "noServer" mode');return this._server?this._server.address():null}close(e){if(this._state===ss){e&&this.once("close",()=>{e(new Error("The server is not running"))}),process.nextTick(Me,this);return}if(e&&this.once("close",e),this._state!==ts)if(this._state=ts,this.options.noServer||this.options.server)this._server&&(this._removeListeners(),this._removeListeners=this._server=null),this.clients?this.clients.size?this._shouldEmitClose=!0:process.nextTick(Me,this):process.nextTick(Me,this);else{let t=this._server;this._removeListeners(),this._removeListeners=this._server=null,t.close(()=>{Me(this)})}}shouldHandle(e){if(this.options.path){let t=e.url.indexOf("?");if((t!==-1?e.url.slice(0,t):e.url)!==this.options.path)return!1}return!0}handleUpgrade(e,t,n,i){t.on("error",ns);let r=e.headers["sec-websocket-key"],o=e.headers.upgrade,a=+e.headers["sec-websocket-version"];if(e.method!=="GET"){se(this,e,t,405,"Invalid HTTP method");return}if(o===void 0||o.toLowerCase()!=="websocket"){se(this,e,t,400,"Invalid Upgrade header");return}if(r===void 0||!mr.test(r)){se(this,e,t,400,"Missing or invalid Sec-WebSocket-Key header");return}if(a!==13&&a!==8){se(this,e,t,400,"Missing or invalid Sec-WebSocket-Version header",{"Sec-WebSocket-Version":"13, 8"});return}if(!this.shouldHandle(e)){Re(t,400);return}let l=e.headers["sec-websocket-protocol"],c=new Set;if(l!==void 0)try{c=dr.parse(l)}catch{se(this,e,t,400,"Invalid Sec-WebSocket-Protocol header");return}let u=e.headers["sec-websocket-extensions"],d={};if(this.options.perMessageDeflate&&u!==void 0){let f=new ne({...this.options.perMessageDeflate,isServer:!0,maxPayload:this.options.maxPayload});try{let p=Qn.parse(u);p[ne.extensionName]&&(f.accept(p[ne.extensionName]),d[ne.extensionName]=f)}catch{se(this,e,t,400,"Invalid or unacceptable Sec-WebSocket-Extensions header");return}}if(this.options.verifyClient){let f={origin:e.headers[`${a===8?"sec-websocket-origin":"origin"}`],secure:!!(e.socket.authorized||e.socket.encrypted),req:e};if(this.options.verifyClient.length===2){this.options.verifyClient(f,(p,m,h,y)=>{if(!p)return Re(t,m||401,h,y);this.completeUpgrade(d,r,c,e,t,n,i)});return}if(!this.options.verifyClient(f))return Re(t,401)}this.completeUpgrade(d,r,c,e,t,n,i)}completeUpgrade(e,t,n,i,r,o,a){if(!r.readable||!r.writable)return r.destroy();if(r[pr])throw new Error("server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration");if(this._state>es)return Re(r,503);let c=["HTTP/1.1 101 Switching Protocols","Upgrade: websocket","Connection: Upgrade",`Sec-WebSocket-Accept: ${lr("sha1").update(t+hr).digest("base64")}`],u=new this.options.WebSocket(null,void 0,this.options);if(n.size){let d=this.options.handleProtocols?this.options.handleProtocols(n,i):n.values().next().value;d&&(c.push(`Sec-WebSocket-Protocol: ${d}`),u._protocol=d)}if(e[ne.extensionName]){let d=e[ne.extensionName].params,f=Qn.format({[ne.extensionName]:[d]});c.push(`Sec-WebSocket-Extensions: ${f}`),u._extensions=e}this.emit("headers",c,i),r.write(c.concat(`\r
`).join(`\r
`)),r.removeListener("error",ns),u.setSocket(r,o,{allowSynchronousEvents:this.options.allowSynchronousEvents,maxBufferedChunks:this.options.maxBufferedChunks,maxFragments:this.options.maxFragments,maxPayload:this.options.maxPayload,skipUTF8Validation:this.options.skipUTF8Validation}),this.clients&&(this.clients.add(u),u.on("close",()=>{this.clients.delete(u),this._shouldEmitClose&&!this.clients.size&&process.nextTick(Me,this)})),a(u,i)}};is.exports=Ht;function gr(s,e){for(let t of Object.keys(e))s.on(t,e[t]);return function(){for(let n of Object.keys(e))s.removeListener(n,e[n])}}function Me(s){s._state=ss,s.emit("close")}function ns(){this.destroy()}function Re(s,e,t,n){t=t||Ke.STATUS_CODES[e],n={Connection:"close","Content-Type":"text/html","Content-Length":Buffer.byteLength(t),...n},s.once("finish",s.destroy),s.end(`HTTP/1.1 ${e} ${Ke.STATUS_CODES[e]}\r
`+Object.keys(n).map(i=>`${i}: ${n[i]}`).join(`\r
`)+`\r
\r
`+t)}function se(s,e,t,n,i,r){if(s.listenerCount("wsClientError")){let o=new Error(i);Error.captureStackTrace(o,se),s.emit("wsClientError",o,t,e)}else Re(t,n,i,r)}});var Zo={};Ks(Zo,{activate:()=>Vo,deactivate:()=>Xo});module.exports=Xs(Zo);var b=S(require("vscode"));var yr=S(Yn(),1),br=S(qe(),1),Tr=S(ue(),1),vr=S(St(),1),Er=S(Mt(),1),wr=S(kt(),1),ie=S(Je(),1),Dt=S(rs(),1);var as=require("events"),os=5,Sr=200,xr=15e3,_r=5e3,Xe=class extends as.EventEmitter{server=null;client=null;clientStale=!1;pingIntervalTimer=null;pongTimeoutTimer=null;pingIntervalMs;pongTimeoutMs;_state="stopped";constructor(e={}){super(),this.pingIntervalMs=e.pingIntervalMs??xr,this.pongTimeoutMs=e.pongTimeoutMs??_r}get state(){return this._state}get isConnected(){return this.client!==null&&this.client.readyState===ie.default.OPEN}async start(e){this.server&&await this.stop();let t;for(let n=1;n<=os;n++)try{await this.startOnce(e);return}catch(i){if(t=i instanceof Error?i:new Error(String(i)),!/already in use/.test(t.message)||n===os)throw t;await Mr(Sr)}throw t??new Error("start() failed")}startOnce(e){return new Promise((t,n)=>{let i=!1;this.server=new Dt.default({port:e,host:"127.0.0.1"}),this.server.on("listening",()=>{i=!0,this.setState("waiting"),t()}),this.server.on("error",r=>{i?(this.setState("error"),this.emit("error",r)):(this.server=null,i=!0,this.setState("error"),r.code==="EADDRINUSE"?n(new Error(`Port ${e} is already in use`)):n(r))}),this.server.on("connection",r=>{if(this.client&&this.client.readyState===ie.default.OPEN&&!this.clientStale){this.emit("rejected"),r.close();return}if(this.client){let o=this.client;this.client=null,this.clientStale=!1,this.stopPingLoop(),this.emit("disconnected"),o.close()}this.client=r,this.clientStale=!1,this.setState("connected"),this.emit("connected"),this.startPingLoop(),r.on("message",o=>{this.markLive();let a;try{a=JSON.parse(o.toString())}catch{this.emit("error",new Error("Failed to parse message: invalid JSON"));return}if(a===null||typeof a!="object"||Array.isArray(a)){let l=Array.isArray(a)?"array":a===null?"null":typeof a;this.emit("error",new Error(`Failed to parse message: expected JSON object, got ${l}`));return}this.emit("message",a)}),r.on("pong",()=>{this.markLive()}),r.on("close",()=>{this.client===r&&(this.client=null,this.clientStale=!1,this.stopPingLoop(),this.setState(this.server?"waiting":"stopped"),this.emit("disconnected"))}),r.on("error",o=>{this.client===r&&(this.client=null,this.clientStale=!1,this.stopPingLoop(),this.setState(this.server?"waiting":"stopped"),this.emit("disconnected")),this.emit("error",o)})})})}stop(){return new Promise(e=>{this.stopPingLoop(),this.client&&(this.client.close(),this.client=null,this.clientStale=!1,this.emit("disconnected")),this.server?this.server.close(()=>{this.server=null,this.setState("stopped"),e()}):(this.setState("stopped"),e())})}send(e){if(this.client&&this.client.readyState===ie.default.OPEN)this.client.send(e);else throw new Error("No active Bitburner connection")}startPingLoop(){this.stopPingLoop(),this.pingIntervalTimer=setInterval(()=>this.sendPing(),this.pingIntervalMs)}stopPingLoop(){this.pingIntervalTimer&&(clearInterval(this.pingIntervalTimer),this.pingIntervalTimer=null),this.pongTimeoutTimer&&(clearTimeout(this.pongTimeoutTimer),this.pongTimeoutTimer=null)}sendPing(){if(!(!this.client||this.client.readyState!==ie.default.OPEN)){try{this.client.ping()}catch{return}this.pongTimeoutTimer&&clearTimeout(this.pongTimeoutTimer),this.pongTimeoutTimer=setTimeout(()=>this.markStale(),this.pongTimeoutMs)}}markStale(){this.pongTimeoutTimer=null,!(!this.client||this.clientStale)&&(this.clientStale=!0,this.setState("stale"))}markLive(){this.pongTimeoutTimer&&(clearTimeout(this.pongTimeoutTimer),this.pongTimeoutTimer=null),this.clientStale&&(this.clientStale=!1,this.client&&this.client.readyState===ie.default.OPEN&&this.setState("connected"))}setState(e){this._state=e,this.emit("stateChanged",e),this._state==="error"&&setTimeout(()=>{this._state==="error"&&(this.setState("stopped"),this.emit("stateChanged","stopped"))},4e3)}};function Mr(s){return new Promise(e=>setTimeout(e,s))}var Ye=class{constructor(e,t=1e4){this.server=e;this.timeout=t,this.onMessage=n=>this.handleMessage(n),this.onDisconnected=()=>this.rejectAllPending("Bitburner disconnected"),this.server.on("message",this.onMessage),this.server.on("disconnected",this.onDisconnected)}server;nextId=1;pending=new Map;timeout;onMessage;onDisconnected;request(e,t){return new Promise((n,i)=>{if(!this.server.isConnected){i(new Error("Not connected to Bitburner"));return}let r=this.nextId++,o={jsonrpc:"2.0",id:r,method:e,params:t},a=setTimeout(()=>{this.pending.delete(r),i(new Error(`Request "${e}" timed out after ${this.timeout}ms`))},this.timeout);this.pending.set(r,{resolve:n,reject:i,timer:a});try{this.server.send(JSON.stringify(o))}catch(l){clearTimeout(a),this.pending.delete(r),i(l instanceof Error?l:new Error(String(l)))}})}handleMessage(e){if(!cs(e))return;let t=e.id;if(typeof t!="number")return;let n=this.pending.get(t);if(!n)return;this.pending.delete(t),clearTimeout(n.timer);let i=e.error;if(i!=null){let r=cs(i)&&typeof i.message=="string"?i.message:`RPC error with malformed shape: ${Rr(i)}`;n.reject(new Error(r));return}n.resolve(e.result)}dispose(){this.server.off("message",this.onMessage),this.server.off("disconnected",this.onDisconnected),this.rejectAllPending("Client disposed")}rejectAllPending(e){if(this.pending.size===0)return;let t=Array.from(this.pending.values());this.pending.clear();for(let n of t)clearTimeout(n.timer),n.reject(new Error(e))}};function cs(s){return typeof s=="object"&&s!==null&&!Array.isArray(s)}function Rr(s){try{return JSON.stringify(s)??String(s)}catch{return String(s)}}var Ze=class{constructor(e,t="home"){this.rpc=e;this.defaultServer=t}rpc;defaultServer;async pushFile(e,t,n){let i={filename:e,content:t,server:n??this.defaultServer};return this.rpc.request("pushFile",i)}async getFile(e,t){let n={filename:e,server:t??this.defaultServer};return this.rpc.request("getFile",n)}async deleteFile(e,t){let n={filename:e,server:t??this.defaultServer};return this.rpc.request("deleteFile",n)}async getFileNames(e){let t={server:e??this.defaultServer};return this.rpc.request("getFileNames",t)}async getAllFiles(){return this.rpc.request("getAllFiles")}async getDefinitionFile(){return this.rpc.request("getDefinitionFile")}async calculateRam(e,t){let n={filename:e,server:t??this.defaultServer};return this.rpc.request("calculateRam",n)}};var ds=S(require("vscode")),Lr="bitburnerSync",Qe=class{get config(){return ds.workspace.getConfiguration(Lr)}get port(){return this.config.get("port",12525)}get autoSync(){return this.config.get("autoSync",!0)}get targetServer(){return this.config.get("targetServer","home")}get fileExtensions(){let e=this.config.inspect("fileExtensions");return(e?.globalValue!==void 0||e?.workspaceValue!==void 0||e?.workspaceFolderValue!==void 0||e?.globalLanguageValue!==void 0||e?.workspaceLanguageValue!==void 0||e?.workspaceFolderLanguageValue!==void 0||e?.defaultLanguageValue!==void 0?this.config.get("fileExtensions",[])??[]:Ot.slice()).map(i=>i.trim().toLowerCase()).map(i=>i.replace(/^\.+/,"")).filter(i=>i.length>0).map(i=>`.${i}`)}get showNotifications(){return this.config.get("showNotifications",!0)}get autoStart(){return this.config.get("autoStart",!1)}get autoDownloadDefinitions(){return this.config.get("autoDownloadDefinitions",!0)}get syncDirectory(){let e=this.normalizedSyncDirectory();return ls(e)?"":e}syncDirectoryError(){let e=this.config.get("syncDirectory","");if(!e)return null;let t=this.normalizedSyncDirectory();return ls(t)?`bitburnerSync.syncDirectory has been ignored because it would escape the workspace: ${JSON.stringify(e)}. Falling back to the workspace root.`:null}normalizedSyncDirectory(){return this.config.get("syncDirectory","").replace(/\\/g,"/").replace(/^\/+/,"").replace(/\/+$/,"")}get fileGlob(){let e=this.fileExtensions.map(n=>n.replace(".",""));return e.length===0?"__bitburnerSync_no_extensions_configured__":`${this.syncDirectory?`${this.syncDirectory}/`:""}**/*.{${e.join(",")}}`}get exclude(){return this.config.get("exclude",[]).map(t=>t.trim().replace(/\\/g,"/")).filter(t=>t.length>0)}},Ot=[".js",".ts",".jsx",".tsx",".txt",".json",".css",".py"];function ls(s){return s?!!(s.split("/").some(e=>e==="..")||/^[A-Za-z]:/.test(s)):!1}var st=S(require("path")),g=S(require("vscode"));var Nt=(s,e,t)=>{let n=s instanceof RegExp?us(s,t):s,i=e instanceof RegExp?us(e,t):e,r=n!==null&&i!=null&&Cr(n,i,t);return r&&{start:r[0],end:r[1],pre:t.slice(0,r[0]),body:t.slice(r[0]+n.length,r[1]),post:t.slice(r[1]+i.length)}},us=(s,e)=>{let t=e.match(s);return t?t[0]:null},Cr=(s,e,t)=>{let n,i,r,o,a,l=t.indexOf(s),c=t.indexOf(e,l+1),u=l;if(l>=0&&c>0){if(s===e)return[l,c];for(n=[],r=t.length;u>=0&&!a;){if(u===l)n.push(u),l=t.indexOf(s,u+1);else if(n.length===1){let d=n.pop();d!==void 0&&(a=[d,c])}else i=n.pop(),i!==void 0&&i<r&&(r=i,o=c),c=t.indexOf(e,u+1);u=l<c&&l>=0?l:c}n.length&&o!==void 0&&(a=[r,o])}return a};var fs="\0SLASH"+Math.random()+"\0",hs="\0OPEN"+Math.random()+"\0",It="\0CLOSE"+Math.random()+"\0",ps="\0COMMA"+Math.random()+"\0",ms="\0PERIOD"+Math.random()+"\0",Pr=new RegExp(fs,"g"),Ar=new RegExp(hs,"g"),kr=new RegExp(It,"g"),Hr=new RegExp(ps,"g"),Dr=new RegExp(ms,"g"),Or=/\\\\/g,Nr=/\\{/g,Fr=/\\}/g,Ir=/\\,/g,Br=/\\\./g,$r=1e5;function Ft(s){return isNaN(s)?s.charCodeAt(0):parseInt(s,10)}function Ur(s){return s.replace(Or,fs).replace(Nr,hs).replace(Fr,It).replace(Ir,ps).replace(Br,ms)}function Wr(s){return s.replace(Pr,"\\").replace(Ar,"{").replace(kr,"}").replace(Hr,",").replace(Dr,".")}function gs(s){if(!s)return[""];let e=[],t=Nt("{","}",s);if(!t)return s.split(",");let{pre:n,body:i,post:r}=t,o=n.split(",");o[o.length-1]+="{"+i+"}";let a=gs(r);return r.length&&(o[o.length-1]+=a.shift(),o.push.apply(o,a)),e.push.apply(e,o),e}function ys(s,e={}){if(!s)return[];let{max:t=$r}=e;return s.slice(0,2)==="{}"&&(s="\\{\\}"+s.slice(2)),Le(Ur(s),t,!0).map(Wr)}function jr(s){return"{"+s+"}"}function qr(s){return/^-?0\d/.test(s)}function Gr(s,e){return s<=e}function zr(s,e){return s>=e}function Le(s,e,t){let n=[],i=Nt("{","}",s);if(!i)return[s];let r=i.pre,o=i.post.length?Le(i.post,e,!1):[""];if(/\$$/.test(i.pre))for(let a=0;a<o.length&&a<e;a++){let l=r+"{"+i.body+"}"+o[a];n.push(l)}else{let a=/^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(i.body),l=/^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(i.body),c=a||l,u=i.body.indexOf(",")>=0;if(!c&&!u)return i.post.match(/,(?!,).*\}/)?(s=i.pre+"{"+i.body+It+i.post,Le(s,e,!0)):[s];let d;if(c)d=i.body.split(/\.\./);else if(d=gs(i.body),d.length===1&&d[0]!==void 0&&(d=Le(d[0],e,!1).map(jr),d.length===1))return o.map(p=>i.pre+d[0]+p);let f;if(c&&d[0]!==void 0&&d[1]!==void 0){let p=Ft(d[0]),m=Ft(d[1]),h=Math.max(d[0].length,d[1].length),y=d.length===3&&d[2]!==void 0?Math.max(Math.abs(Ft(d[2])),1):1,T=Gr;m<p&&(y*=-1,T=zr);let k=d.some(qr);f=[];for(let M=p;T(M,m)&&f.length<e;M+=y){let R;if(l)R=String.fromCharCode(M),R==="\\"&&(R="");else if(R=String(M),k){let ve=h-R.length;if(ve>0){let ce=new Array(ve+1).join("0");M<0?R="-"+ce+R.slice(1):R=ce+R}}f.push(R)}}else{f=[];for(let p=0;p<d.length;p++)f.push.apply(f,Le(d[p],e,!1))}for(let p=0;p<f.length;p++)for(let m=0;m<o.length&&n.length<e;m++){let h=r+f[p]+o[m];(!t||c||h)&&n.push(h)}}return n}var Ce=s=>{if(typeof s!="string")throw new TypeError("invalid pattern");if(s.length>65536)throw new TypeError("pattern is too long")};var Vr={"[:alnum:]":["\\p{L}\\p{Nl}\\p{Nd}",!0],"[:alpha:]":["\\p{L}\\p{Nl}",!0],"[:ascii:]":["\\x00-\\x7f",!1],"[:blank:]":["\\p{Zs}\\t",!0],"[:cntrl:]":["\\p{Cc}",!0],"[:digit:]":["\\p{Nd}",!0],"[:graph:]":["\\p{Z}\\p{C}",!0,!0],"[:lower:]":["\\p{Ll}",!0],"[:print:]":["\\p{C}",!0],"[:punct:]":["\\p{P}",!0],"[:space:]":["\\p{Z}\\t\\r\\n\\v\\f",!0],"[:upper:]":["\\p{Lu}",!0],"[:word:]":["\\p{L}\\p{Nl}\\p{Nd}\\p{Pc}",!0],"[:xdigit:]":["A-Fa-f0-9",!1]},Pe=s=>s.replace(/[[\]\\-]/g,"\\$&"),Jr=s=>s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,"\\$&"),bs=s=>s.join(""),Ts=(s,e)=>{let t=e;if(s.charAt(t)!=="[")throw new Error("not in a brace expression");let n=[],i=[],r=t+1,o=!1,a=!1,l=!1,c=!1,u=t,d="";e:for(;r<s.length;){let h=s.charAt(r);if((h==="!"||h==="^")&&r===t+1){c=!0,r++;continue}if(h==="]"&&o&&!l){u=r+1;break}if(o=!0,h==="\\"&&!l){l=!0,r++;continue}if(h==="["&&!l){for(let[y,[T,v,k]]of Object.entries(Vr))if(s.startsWith(y,r)){if(d)return["$.",!1,s.length-t,!0];r+=y.length,k?i.push(T):n.push(T),a=a||v;continue e}}if(l=!1,d){h>d?n.push(Pe(d)+"-"+Pe(h)):h===d&&n.push(Pe(h)),d="",r++;continue}if(s.startsWith("-]",r+1)){n.push(Pe(h+"-")),r+=2;continue}if(s.startsWith("-",r+1)){d=h,r+=2;continue}n.push(Pe(h)),r++}if(u<r)return["",!1,0,!1];if(!n.length&&!i.length)return["$.",!1,s.length-t,!0];if(i.length===0&&n.length===1&&/^\\?.$/.test(n[0])&&!c){let h=n[0].length===2?n[0].slice(-1):n[0];return[Jr(h),!1,u-t,!1]}let f="["+(c?"^":"")+bs(n)+"]",p="["+(c?"":"^")+bs(i)+"]";return[n.length&&i.length?"("+f+"|"+p+")":n.length?f:p,a,u-t,!0]};var Y=(s,{windowsPathsNoEscape:e=!1,magicalBraces:t=!0}={})=>t?e?s.replace(/\[([^/\\])\]/g,"$1"):s.replace(/((?!\\).|^)\[([^/\\])\]/g,"$1$2").replace(/\\([^/])/g,"$1"):e?s.replace(/\[([^/\\{}])\]/g,"$1"):s.replace(/((?!\\).|^)\[([^/\\{}])\]/g,"$1$2").replace(/\\([^/{}])/g,"$1");var A,Kr=new Set(["!","?","+","*","@"]),Bt=s=>Kr.has(s),vs=s=>Bt(s.type),Xr=new Map([["!",["@"]],["?",["?","@"]],["@",["@"]],["*",["*","+","?","@"]],["+",["+","@"]]]),Yr=new Map([["!",["?"]],["@",["?"]],["+",["?","*"]]]),Zr=new Map([["!",["?","@"]],["?",["?","@"]],["@",["?","@"]],["*",["*","+","?","@"]],["+",["+","@","?","*"]]]),Es=new Map([["!",new Map([["!","@"]])],["?",new Map([["*","*"],["+","*"]])],["@",new Map([["!","!"],["?","?"],["@","@"],["*","*"],["+","+"]])],["+",new Map([["?","*"],["*","*"]])]]),Qr="(?!(?:^|/)\\.\\.?(?:$|/))",et="(?!\\.)",eo=new Set(["[","."]),to=new Set(["..","."]),no=new Set("().*{}+?[]^$\\!"),so=s=>s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,"\\$&"),$t="[^/]",ws=$t+"*?",Ss=$t+"+?",io=0,re=class{type;#n;#s;#i=!1;#e=[];#t;#a;#l;#c=!1;#r;#o;#d=!1;id=++io;get depth(){return(this.#t?.depth??-1)+1}[Symbol.for("nodejs.util.inspect.custom")](){return{"@@type":"AST",id:this.id,type:this.type,root:this.#n.id,parent:this.#t?.id,depth:this.depth,partsLength:this.#e.length,parts:this.#e}}constructor(e,t,n={}){this.type=e,e&&(this.#s=!0),this.#t=t,this.#n=this.#t?this.#t.#n:this,this.#r=this.#n===this?n:this.#n.#r,this.#l=this.#n===this?[]:this.#n.#l,e==="!"&&!this.#n.#c&&this.#l.push(this),this.#a=this.#t?this.#t.#e.length:0}get hasMagic(){if(this.#s!==void 0)return this.#s;for(let e of this.#e)if(typeof e!="string"&&(e.type||e.hasMagic))return this.#s=!0;return this.#s}toString(){return this.#o!==void 0?this.#o:this.type?this.#o=this.type+"("+this.#e.map(e=>String(e)).join("|")+")":this.#o=this.#e.map(e=>String(e)).join("")}#y(){if(this!==this.#n)throw new Error("should only call on root");if(this.#c)return this;this.toString(),this.#c=!0;let e;for(;e=this.#l.pop();){if(e.type!=="!")continue;let t=e,n=t.#t;for(;n;){for(let i=t.#a+1;!n.type&&i<n.#e.length;i++)for(let r of e.#e){if(typeof r=="string")throw new Error("string part in extglob AST??");r.copyIn(n.#e[i])}t=n,n=t.#t}}return this}push(...e){for(let t of e)if(t!==""){if(typeof t!="string"&&!(t instanceof A&&t.#t===this))throw new Error("invalid part: "+t);this.#e.push(t)}}toJSON(){let e=this.type===null?this.#e.slice().map(t=>typeof t=="string"?t:t.toJSON()):[this.type,...this.#e.map(t=>t.toJSON())];return this.isStart()&&!this.type&&e.unshift([]),this.isEnd()&&(this===this.#n||this.#n.#c&&this.#t?.type==="!")&&e.push({}),e}isStart(){if(this.#n===this)return!0;if(!this.#t?.isStart())return!1;if(this.#a===0)return!0;let e=this.#t;for(let t=0;t<this.#a;t++){let n=e.#e[t];if(!(n instanceof A&&n.type==="!"))return!1}return!0}isEnd(){if(this.#n===this||this.#t?.type==="!")return!0;if(!this.#t?.isEnd())return!1;if(!this.type)return this.#t?.isEnd();let e=this.#t?this.#t.#e.length:0;return this.#a===e-1}copyIn(e){typeof e=="string"?this.push(e):this.push(e.clone(this))}clone(e){let t=new A(this.type,e);for(let n of this.#e)t.copyIn(n);return t}static#u(e,t,n,i,r){let o=i.maxExtglobRecursion??2,a=!1,l=!1,c=-1,u=!1;if(t.type===null){let h=n,y="";for(;h<e.length;){let T=e.charAt(h++);if(a||T==="\\"){a=!a,y+=T;continue}if(l){h===c+1?(T==="^"||T==="!")&&(u=!0):T==="]"&&!(h===c+2&&u)&&(l=!1),y+=T;continue}else if(T==="["){l=!0,c=h,u=!1,y+=T;continue}if(!i.noext&&Bt(T)&&e.charAt(h)==="("&&r<=o){t.push(y),y="";let k=new A(T,t);h=A.#u(e,k,h,i,r+1),t.push(k);continue}y+=T}return t.push(y),h}let d=n+1,f=new A(null,t),p=[],m="";for(;d<e.length;){let h=e.charAt(d++);if(a||h==="\\"){a=!a,m+=h;continue}if(l){d===c+1?(h==="^"||h==="!")&&(u=!0):h==="]"&&!(d===c+2&&u)&&(l=!1),m+=h;continue}else if(h==="["){l=!0,c=d,u=!1,m+=h;continue}if(!i.noext&&Bt(h)&&e.charAt(d)==="("&&(r<=o||t&&t.#f(h))){let T=t&&t.#f(h)?0:1;f.push(m),m="";let v=new A(h,f);f.push(v),d=A.#u(e,v,d,i,r+T);continue}if(h==="|"){f.push(m),m="",p.push(f),f=new A(null,t);continue}if(h===")")return m===""&&t.#e.length===0&&(t.#d=!0),f.push(m),m="",t.push(...p,f),d;m+=h}return t.type=null,t.#s=void 0,t.#e=[e.substring(n-1)],d}#b(e){return this.#p(e,Yr)}#p(e,t=Xr){if(!e||typeof e!="object"||e.type!==null||e.#e.length!==1||this.type===null)return!1;let n=e.#e[0];return!n||typeof n!="object"||n.type===null?!1:this.#f(n.type,t)}#f(e,t=Zr){return!!t.get(this.type)?.includes(e)}#T(e,t){let n=e.#e[0],i=new A(null,n,this.options);i.#e.push(""),n.push(i),this.#m(e,t)}#m(e,t){let n=e.#e[0];this.#e.splice(t,1,...n.#e);for(let i of n.#e)typeof i=="object"&&(i.#t=this);this.#o=void 0}#v(e){return!!Es.get(this.type)?.has(e)}#E(e){if(!e||typeof e!="object"||e.type!==null||e.#e.length!==1||this.type===null||this.#e.length!==1)return!1;let t=e.#e[0];return!t||typeof t!="object"||t.type===null?!1:this.#v(t.type)}#w(e){let t=Es.get(this.type),n=e.#e[0],i=t?.get(n.type);if(!i)return!1;this.#e=n.#e;for(let r of this.#e)typeof r=="object"&&(r.#t=this);this.type=i,this.#o=void 0,this.#d=!1}static fromGlob(e,t={}){let n=new A(null,void 0,t);return A.#u(e,n,0,t,0),n}toMMPattern(){if(this!==this.#n)return this.#n.toMMPattern();let e=this.toString(),[t,n,i,r]=this.toRegExpSource();if(!(i||this.#s||this.#r.nocase&&!this.#r.nocaseMagicOnly&&e.toUpperCase()!==e.toLowerCase()))return n;let a=(this.#r.nocase?"i":"")+(r?"u":"");return Object.assign(new RegExp(`^${t}$`,a),{_src:t,_glob:e})}get options(){return this.#r}toRegExpSource(e){let t=e??!!this.#r.dot;if(this.#n===this&&(this.#h(),this.#y()),!vs(this)){let l=this.isStart()&&this.isEnd()&&!this.#e.some(p=>typeof p!="string"),c=this.#e.map(p=>{let[m,h,y,T]=typeof p=="string"?A.#S(p,this.#s,l):p.toRegExpSource(e);return this.#s=this.#s||y,this.#i=this.#i||T,m}).join(""),u="";if(this.isStart()&&typeof this.#e[0]=="string"&&!(this.#e.length===1&&to.has(this.#e[0]))){let m=eo,h=t&&m.has(c.charAt(0))||c.startsWith("\\.")&&m.has(c.charAt(2))||c.startsWith("\\.\\.")&&m.has(c.charAt(4)),y=!t&&!e&&m.has(c.charAt(0));u=h?Qr:y?et:""}let d="";return this.isEnd()&&this.#n.#c&&this.#t?.type==="!"&&(d="(?:$|\\/)"),[u+c+d,Y(c),this.#s=!!this.#s,this.#i]}let n=this.type==="*"||this.type==="+",i=this.type==="!"?"(?:(?!(?:":"(?:",r=this.#g(t);if(this.isStart()&&this.isEnd()&&!r&&this.type!=="!"){let l=this.toString(),c=this;return c.#e=[l],c.type=null,c.#s=void 0,[l,Y(this.toString()),!1,!1]}let o=!n||e||t||!et?"":this.#g(!0);o===r&&(o=""),o&&(r=`(?:${r})(?:${o})*?`);let a="";if(this.type==="!"&&this.#d)a=(this.isStart()&&!t?et:"")+Ss;else{let l=this.type==="!"?"))"+(this.isStart()&&!t&&!e?et:"")+ws+")":this.type==="@"?")":this.type==="?"?")?":this.type==="+"&&o?")":this.type==="*"&&o?")?":`)${this.type}`;a=i+r+l}return[a,Y(r),this.#s=!!this.#s,this.#i]}#h(){if(vs(this)){let e=0,t=!1;do{t=!0;for(let n=0;n<this.#e.length;n++){let i=this.#e[n];typeof i=="object"&&(i.#h(),this.#p(i)?(t=!1,this.#m(i,n)):this.#b(i)?(t=!1,this.#T(i,n)):this.#E(i)&&(t=!1,this.#w(i)))}}while(!t&&++e<10)}else for(let e of this.#e)typeof e=="object"&&e.#h();this.#o=void 0}#g(e){return this.#e.map(t=>{if(typeof t=="string")throw new Error("string type in extglob ast??");let[n,i,r,o]=t.toRegExpSource(e);return this.#i=this.#i||o,n}).filter(t=>!(this.isStart()&&this.isEnd())||!!t).join("|")}static#S(e,t,n=!1){let i=!1,r="",o=!1,a=!1;for(let l=0;l<e.length;l++){let c=e.charAt(l);if(i){i=!1,r+=(no.has(c)?"\\":"")+c;continue}if(c==="*"){if(a)continue;a=!0,r+=n&&/^[*]+$/.test(e)?Ss:ws,t=!0;continue}else a=!1;if(c==="\\"){l===e.length-1?r+="\\\\":i=!0;continue}if(c==="["){let[u,d,f,p]=Ts(e,l);if(f){r+=u,o=o||d,l+=f-1,t=t||p;continue}}if(c==="?"){r+=$t,t=!0;continue}r+=so(c)}return[r,Y(e),!!t,o]}};A=re;var Ut=(s,{windowsPathsNoEscape:e=!1,magicalBraces:t=!1}={})=>t?e?s.replace(/[?*()[\]{}]/g,"[$&]"):s.replace(/[?*()[\]\\{}]/g,"\\$&"):e?s.replace(/[?*()[\]]/g,"[$&]"):s.replace(/[?*()[\]\\]/g,"\\$&");var _=(s,e,t={})=>(Ce(e),!t.nocomment&&e.charAt(0)==="#"?!1:new ye(e,t).match(s)),ro=/^\*+([^+@!?*[(]*)$/,oo=s=>e=>!e.startsWith(".")&&e.endsWith(s),ao=s=>e=>e.endsWith(s),co=s=>(s=s.toLowerCase(),e=>!e.startsWith(".")&&e.toLowerCase().endsWith(s)),lo=s=>(s=s.toLowerCase(),e=>e.toLowerCase().endsWith(s)),uo=/^\*+\.\*+$/,fo=s=>!s.startsWith(".")&&s.includes("."),ho=s=>s!=="."&&s!==".."&&s.includes("."),po=/^\.\*+$/,mo=s=>s!=="."&&s!==".."&&s.startsWith("."),go=/^\*+$/,yo=s=>s.length!==0&&!s.startsWith("."),bo=s=>s.length!==0&&s!=="."&&s!=="..",To=/^\?+([^+@!?*[(]*)?$/,vo=([s,e=""])=>{let t=Ms([s]);return e?(e=e.toLowerCase(),n=>t(n)&&n.toLowerCase().endsWith(e)):t},Eo=([s,e=""])=>{let t=Rs([s]);return e?(e=e.toLowerCase(),n=>t(n)&&n.toLowerCase().endsWith(e)):t},wo=([s,e=""])=>{let t=Rs([s]);return e?n=>t(n)&&n.endsWith(e):t},So=([s,e=""])=>{let t=Ms([s]);return e?n=>t(n)&&n.endsWith(e):t},Ms=([s])=>{let e=s.length;return t=>t.length===e&&!t.startsWith(".")},Rs=([s])=>{let e=s.length;return t=>t.length===e&&t!=="."&&t!==".."},Ls=typeof process=="object"&&process?typeof process.env=="object"&&process.env&&process.env.__MINIMATCH_TESTING_PLATFORM__||process.platform:"posix",xs={win32:{sep:"\\"},posix:{sep:"/"}},xo=Ls==="win32"?xs.win32.sep:xs.posix.sep;_.sep=xo;var L=Symbol("globstar **");_.GLOBSTAR=L;var _o="[^/]",Mo=_o+"*?",Ro="(?:(?!(?:\\/|^)(?:\\.{1,2})($|\\/)).)*?",Lo="(?:(?!(?:\\/|^)\\.).)*?",Co=(s,e={})=>t=>_(t,s,e);_.filter=Co;var F=(s,e={})=>Object.assign({},s,e),Po=s=>{if(!s||typeof s!="object"||!Object.keys(s).length)return _;let e=_;return Object.assign((n,i,r={})=>e(n,i,F(s,r)),{Minimatch:class extends e.Minimatch{constructor(i,r={}){super(i,F(s,r))}static defaults(i){return e.defaults(F(s,i)).Minimatch}},AST:class extends e.AST{constructor(i,r,o={}){super(i,r,F(s,o))}static fromGlob(i,r={}){return e.AST.fromGlob(i,F(s,r))}},unescape:(n,i={})=>e.unescape(n,F(s,i)),escape:(n,i={})=>e.escape(n,F(s,i)),filter:(n,i={})=>e.filter(n,F(s,i)),defaults:n=>e.defaults(F(s,n)),makeRe:(n,i={})=>e.makeRe(n,F(s,i)),braceExpand:(n,i={})=>e.braceExpand(n,F(s,i)),match:(n,i,r={})=>e.match(n,i,F(s,r)),sep:e.sep,GLOBSTAR:L})};_.defaults=Po;var Cs=(s,e={})=>(Ce(s),e.nobrace||!/\{(?:(?!\{).)*\}/.test(s)?[s]:ys(s,{max:e.braceExpandMax}));_.braceExpand=Cs;var Ao=(s,e={})=>new ye(s,e).makeRe();_.makeRe=Ao;var ko=(s,e,t={})=>{let n=new ye(e,t);return s=s.filter(i=>n.match(i)),n.options.nonull&&!s.length&&s.push(e),s};_.match=ko;var _s=/[?*]|[+@!]\(.*?\)|\[|\]/,Ho=s=>s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,"\\$&"),ye=class{options;set;pattern;windowsPathsNoEscape;nonegate;negate;comment;empty;preserveMultipleSlashes;partial;globSet;globParts;nocase;isWindows;platform;windowsNoMagicRoot;maxGlobstarRecursion;regexp;constructor(e,t={}){Ce(e),t=t||{},this.options=t,this.maxGlobstarRecursion=t.maxGlobstarRecursion??200,this.pattern=e,this.platform=t.platform||Ls,this.isWindows=this.platform==="win32";let n="allowWindowsEscape";this.windowsPathsNoEscape=!!t.windowsPathsNoEscape||t[n]===!1,this.windowsPathsNoEscape&&(this.pattern=this.pattern.replace(/\\/g,"/")),this.preserveMultipleSlashes=!!t.preserveMultipleSlashes,this.regexp=null,this.negate=!1,this.nonegate=!!t.nonegate,this.comment=!1,this.empty=!1,this.partial=!!t.partial,this.nocase=!!this.options.nocase,this.windowsNoMagicRoot=t.windowsNoMagicRoot!==void 0?t.windowsNoMagicRoot:!!(this.isWindows&&this.nocase),this.globSet=[],this.globParts=[],this.set=[],this.make()}hasMagic(){if(this.options.magicalBraces&&this.set.length>1)return!0;for(let e of this.set)for(let t of e)if(typeof t!="string")return!0;return!1}debug(...e){}make(){let e=this.pattern,t=this.options;if(!t.nocomment&&e.charAt(0)==="#"){this.comment=!0;return}if(!e){this.empty=!0;return}this.parseNegate(),this.globSet=[...new Set(this.braceExpand())],t.debug&&(this.debug=(...r)=>console.error(...r)),this.debug(this.pattern,this.globSet);let n=this.globSet.map(r=>this.slashSplit(r));this.globParts=this.preprocess(n),this.debug(this.pattern,this.globParts);let i=this.globParts.map((r,o,a)=>{if(this.isWindows&&this.windowsNoMagicRoot){let l=r[0]===""&&r[1]===""&&(r[2]==="?"||!_s.test(r[2]))&&!_s.test(r[3]),c=/^[a-z]:/i.test(r[0]);if(l)return[...r.slice(0,4),...r.slice(4).map(u=>this.parse(u))];if(c)return[r[0],...r.slice(1).map(u=>this.parse(u))]}return r.map(l=>this.parse(l))});if(this.debug(this.pattern,i),this.set=i.filter(r=>r.indexOf(!1)===-1),this.isWindows)for(let r=0;r<this.set.length;r++){let o=this.set[r];o[0]===""&&o[1]===""&&this.globParts[r][2]==="?"&&typeof o[3]=="string"&&/^[a-z]:$/i.test(o[3])&&(o[2]="?")}this.debug(this.pattern,this.set)}preprocess(e){if(this.options.noglobstar)for(let n of e)for(let i=0;i<n.length;i++)n[i]==="**"&&(n[i]="*");let{optimizationLevel:t=1}=this.options;return t>=2?(e=this.firstPhasePreProcess(e),e=this.secondPhasePreProcess(e)):t>=1?e=this.levelOneOptimize(e):e=this.adjascentGlobstarOptimize(e),e}adjascentGlobstarOptimize(e){return e.map(t=>{let n=-1;for(;(n=t.indexOf("**",n+1))!==-1;){let i=n;for(;t[i+1]==="**";)i++;i!==n&&t.splice(n,i-n)}return t})}levelOneOptimize(e){return e.map(t=>(t=t.reduce((n,i)=>{let r=n[n.length-1];return i==="**"&&r==="**"?n:i===".."&&r&&r!==".."&&r!=="."&&r!=="**"?(n.pop(),n):(n.push(i),n)},[]),t.length===0?[""]:t))}levelTwoFileOptimize(e){Array.isArray(e)||(e=this.slashSplit(e));let t=!1;do{if(t=!1,!this.preserveMultipleSlashes){for(let i=1;i<e.length-1;i++){let r=e[i];i===1&&r===""&&e[0]===""||(r==="."||r==="")&&(t=!0,e.splice(i,1),i--)}e[0]==="."&&e.length===2&&(e[1]==="."||e[1]==="")&&(t=!0,e.pop())}let n=0;for(;(n=e.indexOf("..",n+1))!==-1;){let i=e[n-1];i&&i!=="."&&i!==".."&&i!=="**"&&!(this.isWindows&&/^[a-z]:$/i.test(i))&&(t=!0,e.splice(n-1,2),n-=2)}}while(t);return e.length===0?[""]:e}firstPhasePreProcess(e){let t=!1;do{t=!1;for(let n of e){let i=-1;for(;(i=n.indexOf("**",i+1))!==-1;){let o=i;for(;n[o+1]==="**";)o++;o>i&&n.splice(i+1,o-i);let a=n[i+1],l=n[i+2],c=n[i+3];if(a!==".."||!l||l==="."||l===".."||!c||c==="."||c==="..")continue;t=!0,n.splice(i,1);let u=n.slice(0);u[i]="**",e.push(u),i--}if(!this.preserveMultipleSlashes){for(let o=1;o<n.length-1;o++){let a=n[o];o===1&&a===""&&n[0]===""||(a==="."||a==="")&&(t=!0,n.splice(o,1),o--)}n[0]==="."&&n.length===2&&(n[1]==="."||n[1]==="")&&(t=!0,n.pop())}let r=0;for(;(r=n.indexOf("..",r+1))!==-1;){let o=n[r-1];if(o&&o!=="."&&o!==".."&&o!=="**"){t=!0;let l=r===1&&n[r+1]==="**"?["."]:[];n.splice(r-1,2,...l),n.length===0&&n.push(""),r-=2}}}}while(t);return e}secondPhasePreProcess(e){for(let t=0;t<e.length-1;t++)for(let n=t+1;n<e.length;n++){let i=this.partsMatch(e[t],e[n],!this.preserveMultipleSlashes);if(i){e[t]=[],e[n]=i;break}}return e.filter(t=>t.length)}partsMatch(e,t,n=!1){let i=0,r=0,o=[],a="";for(;i<e.length&&r<t.length;)if(e[i]===t[r])o.push(a==="b"?t[r]:e[i]),i++,r++;else if(n&&e[i]==="**"&&t[r]===e[i+1])o.push(e[i]),i++;else if(n&&t[r]==="**"&&e[i]===t[r+1])o.push(t[r]),r++;else if(e[i]==="*"&&t[r]&&(this.options.dot||!t[r].startsWith("."))&&t[r]!=="**"){if(a==="b")return!1;a="a",o.push(e[i]),i++,r++}else if(t[r]==="*"&&e[i]&&(this.options.dot||!e[i].startsWith("."))&&e[i]!=="**"){if(a==="a")return!1;a="b",o.push(t[r]),i++,r++}else return!1;return e.length===t.length&&o}parseNegate(){if(this.nonegate)return;let e=this.pattern,t=!1,n=0;for(let i=0;i<e.length&&e.charAt(i)==="!";i++)t=!t,n++;n&&(this.pattern=e.slice(n)),this.negate=t}matchOne(e,t,n=!1){let i=0,r=0;if(this.isWindows){let a=typeof e[0]=="string"&&/^[a-z]:$/i.test(e[0]),l=!a&&e[0]===""&&e[1]===""&&e[2]==="?"&&/^[a-z]:$/i.test(e[3]),c=typeof t[0]=="string"&&/^[a-z]:$/i.test(t[0]),u=!c&&t[0]===""&&t[1]===""&&t[2]==="?"&&typeof t[3]=="string"&&/^[a-z]:$/i.test(t[3]),d=l?3:a?0:void 0,f=u?3:c?0:void 0;if(typeof d=="number"&&typeof f=="number"){let[p,m]=[e[d],t[f]];p.toLowerCase()===m.toLowerCase()&&(t[f]=p,r=f,i=d)}}let{optimizationLevel:o=1}=this.options;return o>=2&&(e=this.levelTwoFileOptimize(e)),t.includes(L)?this.#n(e,t,n,i,r):this.#i(e,t,n,i,r)}#n(e,t,n,i,r){let o=t.indexOf(L,r),a=t.lastIndexOf(L),[l,c,u]=n?[t.slice(r,o),t.slice(o+1),[]]:[t.slice(r,o),t.slice(o+1,a),t.slice(a+1)];if(l.length){let v=e.slice(i,i+l.length);if(!this.#i(v,l,n,0,0))return!1;i+=l.length,r+=l.length}let d=0;if(u.length){if(u.length+i>e.length)return!1;let v=e.length-u.length;if(this.#i(e,u,n,v,0))d=u.length;else{if(e[e.length-1]!==""||i+u.length===e.length||(v--,!this.#i(e,u,n,v,0)))return!1;d=u.length+1}}if(!c.length){let v=!!d;for(let k=i;k<e.length-d;k++){let M=String(e[k]);if(v=!0,M==="."||M===".."||!this.options.dot&&M.startsWith("."))return!1}return n||v}let f=[[[],0]],p=f[0],m=0,h=[0];for(let v of c)v===L?(h.push(m),p=[[],0],f.push(p)):(p[0].push(v),m++);let y=f.length-1,T=e.length-d;for(let v of f)v[1]=T-(h[y--]+v[0].length);return!!this.#s(e,f,i,0,n,0,!!d)}#s(e,t,n,i,r,o,a){let l=t[i];if(!l){for(let d=n;d<e.length;d++){a=!0;let f=e[d];if(f==="."||f===".."||!this.options.dot&&f.startsWith("."))return!1}return a}let[c,u]=l;for(;n<=u;){if(this.#i(e.slice(0,n+c.length),c,r,n,0)&&o<this.maxGlobstarRecursion){let p=this.#s(e,t,n+c.length,i+1,r,o+1,a);if(p!==!1)return p}let f=e[n];if(f==="."||f===".."||!this.options.dot&&f.startsWith("."))return!1;n++}return r||null}#i(e,t,n,i,r){let o,a,l,c;for(o=i,a=r,c=e.length,l=t.length;o<c&&a<l;o++,a++){this.debug("matchOne loop");let u=t[a],d=e[o];if(this.debug(t,u,d),u===!1||u===L)return!1;let f;if(typeof u=="string"?(f=d===u,this.debug("string match",u,d,f)):(f=u.test(d),this.debug("pattern match",u,d,f)),!f)return!1}if(o===c&&a===l)return!0;if(o===c)return n;if(a===l)return o===c-1&&e[o]==="";throw new Error("wtf?")}braceExpand(){return Cs(this.pattern,this.options)}parse(e){Ce(e);let t=this.options;if(e==="**")return L;if(e==="")return"";let n,i=null;(n=e.match(go))?i=t.dot?bo:yo:(n=e.match(ro))?i=(t.nocase?t.dot?lo:co:t.dot?ao:oo)(n[1]):(n=e.match(To))?i=(t.nocase?t.dot?Eo:vo:t.dot?wo:So)(n):(n=e.match(uo))?i=t.dot?ho:fo:(n=e.match(po))&&(i=mo);let r=re.fromGlob(e,this.options).toMMPattern();return i&&typeof r=="object"&&Reflect.defineProperty(r,"test",{value:i}),r}makeRe(){if(this.regexp||this.regexp===!1)return this.regexp;let e=this.set;if(!e.length)return this.regexp=!1,this.regexp;let t=this.options,n=t.noglobstar?Mo:t.dot?Ro:Lo,i=new Set(t.nocase?["i"]:[]),r=e.map(l=>{let c=l.map(d=>{if(d instanceof RegExp)for(let f of d.flags.split(""))i.add(f);return typeof d=="string"?Ho(d):d===L?L:d._src});c.forEach((d,f)=>{let p=c[f+1],m=c[f-1];d!==L||m===L||(m===void 0?p!==void 0&&p!==L?c[f+1]="(?:\\/|"+n+"\\/)?"+p:c[f]=n:p===void 0?c[f-1]=m+"(?:\\/|\\/"+n+")?":p!==L&&(c[f-1]=m+"(?:\\/|\\/"+n+"\\/)"+p,c[f+1]=L))});let u=c.filter(d=>d!==L);if(this.partial&&u.length>=1){let d=[];for(let f=1;f<=u.length;f++)d.push(u.slice(0,f).join("/"));return"(?:"+d.join("|")+")"}return u.join("/")}).join("|"),[o,a]=e.length>1?["(?:",")"]:["",""];r="^"+o+r+a+"$",this.partial&&(r="^(?:\\/|"+o+r.slice(1,-1)+a+")$"),this.negate&&(r="^(?!"+r+").+$");try{this.regexp=new RegExp(r,[...i].join(""))}catch{this.regexp=!1}return this.regexp}slashSplit(e){return this.preserveMultipleSlashes?e.split("/"):this.isWindows&&/^\/\/[^/]+/.test(e)?["",...e.split(/\/+/)]:e.split(/\/+/)}match(e,t=this.partial){if(this.debug("match",e,this.pattern),this.comment)return!1;if(this.empty)return e==="";if(e==="/"&&t)return!0;let n=this.options;this.isWindows&&(e=e.split("\\").join("/"));let i=this.slashSplit(e);this.debug(this.pattern,"split",i);let r=this.set;this.debug(this.pattern,"set",r);let o=i[i.length-1];if(!o)for(let a=i.length-2;!o&&a>=0;a--)o=i[a];for(let a of r){let l=i;if(n.matchBase&&a.length===1&&(l=[o]),this.matchOne(l,a,t))return n.flipNegate?!0:!this.negate}return n.flipNegate?!1:this.negate}static defaults(e){return _.defaults(e).Minimatch}};_.AST=re;_.Minimatch=ye;_.escape=Ut;_.unescape=Y;var tt=S(require("path")),Ps=S(require("vscode")),be=class{constructor(e){this.config=e}config;mapToRemote(e){let t=Ps.workspace.workspaceFolders?.[0];if(!t)throw new Error(`File ${e.fsPath} is not in a workspace folder`);let n=tt.relative(t.uri.fsPath,e.fsPath).replace(/\\/g,"/");if(n===".."||n.startsWith("../")||tt.isAbsolute(n))throw new Error(`File ${e.fsPath} is not in the primary workspace folder (${t.uri.fsPath})`);let i=this.config.syncDirectory,r=n;if(i){if(n!==i&&!n.startsWith(i+"/"))throw new Error(`File ${e.fsPath} is outside the sync directory '${i}'`);r=n.slice(i.length)}return r.startsWith("/")||(r="/"+r),this.validate(r),r}validate(e){Wt(e)}};function Wt(s){if(!s)throw new Error("Empty remote path");if(/[\x00-\x1f\x7f-\x9f]/.test(s))throw new Error(`Control character in remote path: ${JSON.stringify(s)}`);if(/[*?\[\]]/.test(s))throw new Error(`Invalid characters in path: ${s}`);if(s.split("/").some(e=>e===".."))throw new Error(`Path traversal not allowed: ${s}`);if(s.includes("\\"))throw new Error(`Backslash not allowed in remote path: ${s}`);if(s.includes("//"))throw new Error(`Double slashes not allowed: ${s}`);if(s.includes(":"))throw new Error(`Colon not allowed in remote path: ${s}`)}var As=`    namespace React {
        // --------------------------------------------------------------
        // Core primitives
        // --------------------------------------------------------------

        type Key = string | number;

        interface RefObject<T> {
            readonly current: T | null;
        }

        interface MutableRefObject<T> {
            current: T;
        }

        type RefCallback<T> = (instance: T | null) => void;
        type Ref<T> = RefCallback<T> | RefObject<T> | null;
        type LegacyRef<T> = string | Ref<T>;

        type ComponentState = any;

        interface Attributes {
            key?: Key | null | undefined;
        }
        interface ClassAttributes<T> extends Attributes {
            ref?: LegacyRef<T> | undefined;
        }

        // --------------------------------------------------------------
        // Elements and nodes
        // --------------------------------------------------------------

        interface ReactElement<
            P = any,
            T extends string | JSXElementConstructor<any> =
                | string
                | JSXElementConstructor<any>,
        > {
            type: T;
            props: P;
            key: Key | null;
        }

        type JSXElementConstructor<P> =
            | ((props: P) => ReactElement<any, any> | null)
            | (new (props: P) => Component<P, any>);

        type ReactText = string | number;
        type ReactChild = ReactElement | ReactText;
        interface ReactNodeArray extends ReadonlyArray<ReactNode> {}
        type ReactFragment = Iterable<ReactNode>;
        type ReactNode =
            | ReactChild
            | ReactFragment
            | ReactPortal
            | boolean
            | null
            | undefined;

        interface ReactPortal extends ReactElement {
            key: Key | null;
            children: ReactNode;
        }

        // --------------------------------------------------------------
        // Components
        // --------------------------------------------------------------

        type ComponentType<P = {}> = ComponentClass<P> | FunctionComponent<P>;

        interface FunctionComponent<P = {}> {
            (props: PropsWithChildren<P>, context?: any): ReactElement<any, any> | null;
            displayName?: string | undefined;
            defaultProps?: Partial<P> | undefined;
        }
        type FC<P = {}> = FunctionComponent<P>;

        interface ComponentClass<P = {}, S = ComponentState> {
            new (props: P, context?: any): Component<P, S>;
            displayName?: string | undefined;
            defaultProps?: Partial<P> | undefined;
            contextType?: Context<any> | undefined;
        }

        type PropsWithChildren<P = unknown> = P & { children?: ReactNode | undefined };
        type PropsWithRef<P> = P;
        type PropsWithoutRef<P> = Pick<P, Exclude<keyof P, "ref">>;

        /**
         * Base class for class-based React components with local state and
         * lifecycle methods. Subclass and implement \`render()\` to return the
         * component's UI, then update \`state\` via \`setState()\`.
         *
         * @example
         *     class Counter extends React.Component<{}, { n: number }> {
         *         state = { n: 0 };
         *         render() {
         *             return React.createElement("button",
         *                 { onClick: () => this.setState({ n: this.state.n + 1 }) },
         *                 \`Count: \${this.state.n}\`);
         *         }
         *     }
         *
         * For most cases prefer function components with hooks \u2014 they're
         * shorter, easier to reason about, and the recommended default.
         *
         * @see https://react.dev/reference/react/Component
         */
        class Component<P = {}, S = {}> {
            constructor(props: Readonly<P> | P);
            constructor(props: P, context: any);
            /**
             * Schedule an update to the component's local state. React
             * merges the returned partial into the current state and
             * re-renders. State updates are asynchronous and may be
             * batched \u2014 never mutate \`this.state\` directly.
             *
             * Pass a function \`(prev, props) => next\` when the next state
             * depends on the current state to avoid stale-read bugs.
             */
            setState<K extends keyof S>(
                state:
                    | ((prevState: Readonly<S>, props: Readonly<P>) => Pick<S, K> | S | null)
                    | (Pick<S, K> | S | null),
                callback?: () => void,
            ): void;
            /**
             * Skip \`shouldComponentUpdate\` and force a re-render. Almost
             * always the wrong tool \u2014 prefer \`setState\` and let React decide.
             */
            forceUpdate(callback?: () => void): void;
            render(): ReactNode;
            readonly props: Readonly<P> & Readonly<{ children?: ReactNode | undefined }>;
            state: Readonly<S>;
            context: any;
            refs: { [key: string]: any };
        }
        /**
         * Like \`Component\`, but with a shallow-equal \`shouldComponentUpdate\`
         * baked in \u2014 skips re-renders when both props and state are shallowly
         * equal to the previous values. Useful for expensive renders where
         * parents re-render frequently but props rarely change.
         *
         * @see https://react.dev/reference/react/PureComponent
         */
        class PureComponent<P = {}, S = {}> extends Component<P, S> {}

        // --------------------------------------------------------------
        // Element factories
        // --------------------------------------------------------------

        /**
         * Group children without emitting a wrapper DOM node. Use when a
         * component needs to return multiple sibling elements but you don't
         * want an extra \`<div>\` in the tree. In JSX, the shorthand \`<>\u2026</>\`
         * is equivalent to \`<React.Fragment>\u2026</React.Fragment>\`.
         *
         * @see https://react.dev/reference/react/Fragment
         */
        const Fragment: JSXElementConstructor<{ children?: ReactNode }>;
        /**
         * Development-only wrapper that opts children into extra checks \u2014
         * double-invokes render/effect bodies to surface impure code, warns
         * on deprecated APIs. No runtime effect in production builds.
         *
         * @see https://react.dev/reference/react/StrictMode
         */
        const StrictMode: JSXElementConstructor<{ children?: ReactNode }>;
        /**
         * Declaratively wait for something (usually \`React.lazy\` or a data
         * fetch) to load before rendering children, showing \`fallback\` in
         * the meantime.
         *
         * @example
         *     const Big = React.lazy(() => import("./Big"));
         *     <React.Suspense fallback={<div>loading\u2026</div>}>
         *         <Big />
         *     </React.Suspense>
         *
         * @see https://react.dev/reference/react/Suspense
         */
        const Suspense: JSXElementConstructor<{ children?: ReactNode; fallback?: ReactNode }>;

        /**
         * Create a React element without JSX. \`type\` is either a string
         * (intrinsic HTML tag) or a component. In \`.tsx\` files, prefer
         * JSX syntax \u2014 this is the underlying primitive it desugars to.
         *
         * @example
         *     React.createElement("div", { className: "row" },
         *         React.createElement("span", null, "hi"))
         *     // equivalent JSX: <div className="row"><span>hi</span></div>
         *
         * @see https://react.dev/reference/react/createElement
         */
        function createElement<P extends {}>(
            type: string | JSXElementConstructor<P>,
            props?: (Attributes & P) | null,
            ...children: ReactNode[]
        ): ReactElement<P>;
        /**
         * Duplicate an existing element, optionally overriding props or
         * children. The original element is left untouched. Typically used
         * by higher-order components that want to inject extra props into
         * children they didn't create.
         *
         * @see https://react.dev/reference/react/cloneElement
         */
        function cloneElement<P>(
            element: ReactElement<P>,
            props?: Partial<P> & Attributes,
            ...children: ReactNode[]
        ): ReactElement<P>;
        /**
         * Type guard: true iff \`object\` is a React element created by
         * \`createElement\` or JSX. Useful when walking \`children\` prop
         * that may contain plain strings/numbers alongside elements.
         */
        function isValidElement<P>(object: {} | null | undefined): object is ReactElement<P>;
        /**
         * Create an empty ref object for use with class components'
         * \`ref\` prop. In function components, prefer \`useRef\` instead
         * (this exists mainly for legacy class code).
         */
        function createRef<T>(): RefObject<T>;

        // --------------------------------------------------------------
        // Context
        // --------------------------------------------------------------

        interface ProviderProps<T> {
            value: T;
            children?: ReactNode | undefined;
        }
        interface ConsumerProps<T> {
            children: (value: T) => ReactNode;
        }
        interface Provider<T> {
            (props: ProviderProps<T>): ReactElement<any, any> | null;
        }
        interface Consumer<T> {
            (props: ConsumerProps<T>): ReactElement<any, any> | null;
        }
        interface Context<T> {
            Provider: Provider<T>;
            Consumer: Consumer<T>;
            displayName?: string | undefined;
        }
        /**
         * Create a Context object for passing values through the tree
         * without threading props at every level. Wrap subtrees in
         * \`<Ctx.Provider value={\u2026}>\` and read the current value with
         * \`useContext(Ctx)\` (or the class-based \`<Ctx.Consumer>\`).
         *
         * @example
         *     const Theme = React.createContext<"light" | "dark">("light");
         *     // Provide:
         *     <Theme.Provider value="dark"><App /></Theme.Provider>
         *     // Read:
         *     const theme = React.useContext(Theme);
         *
         * @see https://react.dev/reference/react/createContext
         */
        function createContext<T>(defaultValue: T): Context<T>;

        // --------------------------------------------------------------
        // Refs / memo / lazy / forwardRef
        // --------------------------------------------------------------

        interface ExoticComponent<P = {}> {
            (props: P): ReactElement | null;
            readonly $$typeof: symbol;
            displayName?: string | undefined;
        }
        interface MemoExoticComponent<T extends ComponentType<any>> extends ExoticComponent<any> {
            readonly type: T;
        }
        interface LazyExoticComponent<T extends ComponentType<any>> extends ExoticComponent<any> {
            readonly _result: T;
        }
        interface ForwardRefExoticComponent<P> extends ExoticComponent<P> {
            defaultProps?: Partial<P> | undefined;
        }

        /**
         * Let a function component receive a \`ref\` from its parent and
         * attach it to a DOM node or imperative handle it exposes. Refs
         * are otherwise not passed through function components.
         *
         * @example
         *     const Input = React.forwardRef<HTMLInputElement, { label: string }>(
         *         (props, ref) => React.createElement("input", { ref, "aria-label": props.label })
         *     );
         *
         * @see https://react.dev/reference/react/forwardRef
         */
        function forwardRef<T, P = {}>(
            render: (props: P, ref: Ref<T>) => ReactElement | null,
        ): ForwardRefExoticComponent<PropsWithoutRef<P> & { ref?: Ref<T> | undefined }>;

        /**
         * Wrap a component so React skips re-rendering it when its props
         * haven't shallowly changed. Use for expensive components inside
         * parents that re-render frequently. Optionally supply
         * \`propsAreEqual\` for custom comparison.
         *
         * @see https://react.dev/reference/react/memo
         */
        function memo<P extends object>(
            Component: FunctionComponent<P>,
            propsAreEqual?: (prev: Readonly<P>, next: Readonly<P>) => boolean,
        ): MemoExoticComponent<FunctionComponent<P>>;
        function memo<T extends ComponentType<any>>(
            Component: T,
            propsAreEqual?: (prev: any, next: any) => boolean,
        ): MemoExoticComponent<T>;

        /**
         * Declare a component that loads on demand. The factory is called
         * the first time the component renders, and the result is cached.
         * Must be rendered inside \`<React.Suspense>\` so React has a
         * fallback to show while loading.
         *
         * @example
         *     const Big = React.lazy(() => import("./Big"));
         *     <React.Suspense fallback={<Spinner />}><Big /></React.Suspense>
         *
         * @see https://react.dev/reference/react/lazy
         */
        function lazy<T extends ComponentType<any>>(
            factory: () => Promise<{ default: T }>,
        ): LazyExoticComponent<T>;

        // --------------------------------------------------------------
        // Hooks
        // --------------------------------------------------------------

        type SetStateAction<S> = S | ((prev: S) => S);
        type Dispatch<A> = (value: A) => void;
        type Reducer<S, A> = (prev: S, action: A) => S;
        type ReducerState<R extends Reducer<any, any>> = R extends Reducer<infer S, any> ? S : never;
        type ReducerAction<R extends Reducer<any, any>> = R extends Reducer<any, infer A> ? A : never;

        type EffectCallback = () => void | (() => void | undefined);
        type DependencyList = ReadonlyArray<unknown>;

        /**
         * Add a piece of local, mutable state to a function component.
         * Returns the current value and a setter that schedules a
         * re-render with the new value.
         *
         * If \`initial\` is a function it's called once, on mount \u2014 useful
         * for expensive initial values. The setter accepts either a new
         * value or an updater \`prev => next\` \u2014 prefer the updater form
         * when the next value depends on the previous one.
         *
         * @example
         *     const [count, setCount] = React.useState(0);
         *     // ...
         *     setCount(c => c + 1);  // safe under batching
         *
         * @see https://react.dev/reference/react/useState
         */
        function useState<S>(initial: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
        function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];

        /**
         * Alternative to \`useState\` for complex state transitions. You
         * dispatch actions and a pure reducer computes the next state.
         * Useful when state updates involve multiple related values or
         * when the transition logic is worth extracting from the component.
         *
         * @example
         *     type Action = { kind: "inc" } | { kind: "reset" };
         *     const reducer = (n: number, a: Action) =>
         *         a.kind === "inc" ? n + 1 : 0;
         *     const [count, dispatch] = React.useReducer(reducer, 0);
         *     // dispatch({ kind: "inc" });
         *
         * @see https://react.dev/reference/react/useReducer
         */
        function useReducer<R extends Reducer<any, any>, I>(
            reducer: R,
            initializerArg: I,
            initializer: (arg: I) => ReducerState<R>,
        ): [ReducerState<R>, Dispatch<ReducerAction<R>>];
        function useReducer<R extends Reducer<any, any>>(
            reducer: R,
            initialState: ReducerState<R>,
            initializer?: undefined,
        ): [ReducerState<R>, Dispatch<ReducerAction<R>>];

        /**
         * Run a side effect after render commits \u2014 subscriptions, timers,
         * imperative DOM tweaks, network calls. Return a cleanup function
         * for anything that must be torn down (unsubscribe, clearInterval).
         *
         * \`deps\` controls when the effect re-runs:
         *   - \`undefined\`  \u2192 after every render
         *   - \`[]\`         \u2192 once, on mount (cleanup on unmount)
         *   - \`[a, b]\`     \u2192 whenever \`a\` or \`b\` changes (referential equality)
         *
         * @example
         *     React.useEffect(() => {
         *         const id = setInterval(tick, 1000);
         *         return () => clearInterval(id);
         *     }, []);
         *
         * @see https://react.dev/reference/react/useEffect
         */
        function useEffect(effect: EffectCallback, deps?: DependencyList): void;
        /**
         * Like \`useEffect\`, but fires synchronously after DOM mutations
         * and before the browser paints. Use only when you need to read
         * layout and re-render before the user sees the intermediate
         * state (e.g. measuring a node to position a tooltip). Blocks
         * paint, so keep the body cheap.
         *
         * @see https://react.dev/reference/react/useLayoutEffect
         */
        function useLayoutEffect(effect: EffectCallback, deps?: DependencyList): void;
        /**
         * Runs before any layout effect fires. Intended for CSS-in-JS
         * libraries to inject styles before children read layout. You
         * almost certainly want \`useEffect\` or \`useLayoutEffect\` instead.
         *
         * @see https://react.dev/reference/react/useInsertionEffect
         */
        function useInsertionEffect(effect: EffectCallback, deps?: DependencyList): void;

        /**
         * Memoize an expensive computed value. \`factory\` re-runs only when
         * one of \`deps\` changes (by referential equality). Useful for
         * skipping heavy work on every render, or for stabilizing object
         * references passed to memoized children.
         *
         * Don't reach for this reflexively \u2014 the deps check has its own
         * cost. Measure before wrapping.
         *
         * @example
         *     const sorted = React.useMemo(() => [...items].sort(cmp), [items]);
         *
         * @see https://react.dev/reference/react/useMemo
         */
        function useMemo<T>(factory: () => T, deps: DependencyList | undefined): T;
        /**
         * Return the same function reference across renders (as long as
         * \`deps\` don't change). Equivalent to \`useMemo(() => fn, deps)\`
         * for functions. Mostly useful when passing callbacks to memoized
         * children so their memoization actually holds.
         *
         * @example
         *     const onClick = React.useCallback(
         *         (e: React.MouseEvent) => selectItem(id),
         *         [id]
         *     );
         *
         * @see https://react.dev/reference/react/useCallback
         */
        function useCallback<T extends (...args: any[]) => any>(fn: T, deps: DependencyList): T;

        /**
         * Hold a mutable value across renders without triggering re-renders
         * when it changes. Two common uses:
         *
         *   - **DOM refs:** pass the returned object as JSX \`ref={\u2026}\` and
         *     read \`ref.current\` in an effect to reach the DOM node.
         *   - **Instance-like storage:** stash any value you want to persist
         *     between renders but don't want in state.
         *
         * @example
         *     const inputRef = React.useRef<HTMLInputElement>(null);
         *     React.useEffect(() => { inputRef.current?.focus(); }, []);
         *
         * @see https://react.dev/reference/react/useRef
         */
        function useRef<T>(initialValue: T): MutableRefObject<T>;
        function useRef<T>(initialValue: T | null): RefObject<T>;
        function useRef<T = undefined>(): MutableRefObject<T | undefined>;

        /**
         * Read the current value of a Context inside a function component.
         * The component re-renders whenever the nearest matching Provider's
         * \`value\` changes.
         *
         * @example
         *     const theme = React.useContext(ThemeContext);
         *
         * @see https://react.dev/reference/react/useContext
         */
        function useContext<T>(context: Context<T>): T;
        /**
         * Attach a label to a custom hook for React DevTools. No effect
         * at runtime outside DevTools.
         */
        function useDebugValue<T>(value: T, format?: (value: T) => any): void;

        /**
         * Customize the value exposed via a forwarded ref. Rarely needed \u2014
         * use only when a component must expose imperative methods (e.g.
         * \`.focus()\`, \`.scrollIntoView()\`) instead of a raw DOM node.
         *
         * @see https://react.dev/reference/react/useImperativeHandle
         */
        function useImperativeHandle<T, R extends T>(
            ref: Ref<T> | undefined,
            init: () => R,
            deps?: DependencyList,
        ): void;

        /**
         * Mark a state update as a non-urgent transition \u2014 React can
         * interrupt it if a more urgent update arrives. Returns
         * \`[isPending, startTransition]\`. Use for expensive re-renders
         * driven by fast-changing input (search-as-you-type, filtering
         * large lists) so the input itself stays responsive.
         *
         * @see https://react.dev/reference/react/useTransition
         */
        function useTransition(): [boolean, (callback: () => void) => void];
        /**
         * Return a "delayed" copy of a value: during urgent updates the
         * old value is preserved so expensive children don't have to
         * re-render right away. Complement to \`useTransition\` for values
         * you don't control the source of.
         *
         * @see https://react.dev/reference/react/useDeferredValue
         */
        function useDeferredValue<T>(value: T): T;
        /**
         * Generate a stable, unique ID string for the lifetime of the
         * component. Handy for pairing \`<label htmlFor>\` with input IDs
         * without hand-rolling counters.
         *
         * @see https://react.dev/reference/react/useId
         */
        function useId(): string;
        /**
         * Subscribe a component to an external store and re-render when
         * the store changes. Purpose-built for library authors integrating
         * non-React state (Redux-like stores, browser APIs). App code
         * usually reaches for \`useState\` / \`useReducer\` instead.
         *
         * @see https://react.dev/reference/react/useSyncExternalStore
         */
        function useSyncExternalStore<Snapshot>(
            subscribe: (onStoreChange: () => void) => () => void,
            getSnapshot: () => Snapshot,
            getServerSnapshot?: () => Snapshot,
        ): Snapshot;

        // --------------------------------------------------------------
        // CSS + events (typed permissively \u2014 full csstype/DOM detail is
        // out of scope for a self-contained shim)
        // --------------------------------------------------------------

        // Loose but useful: string values for anything, number values are
        // accepted for the numeric-shaped properties React itself allows.
        // Users who want strict per-property typing can install
        // @types/react in their workspace and let module augmentation
        // replace this.
        interface CSSProperties {
            [key: string]: string | number | null | undefined;
        }

        interface SyntheticEvent<T = Element, E = Event> {
            bubbles: boolean;
            cancelable: boolean;
            currentTarget: EventTarget & T;
            defaultPrevented: boolean;
            eventPhase: number;
            isTrusted: boolean;
            nativeEvent: E;
            preventDefault(): void;
            isDefaultPrevented(): boolean;
            stopPropagation(): void;
            isPropagationStopped(): boolean;
            persist(): void;
            target: EventTarget;
            timeStamp: number;
            type: string;
        }
        interface ClipboardEvent<T = Element> extends SyntheticEvent<T> {
            clipboardData: DataTransfer;
        }
        interface CompositionEvent<T = Element> extends SyntheticEvent<T> {
            data: string;
        }
        interface DragEvent<T = Element> extends MouseEvent<T> {
            dataTransfer: DataTransfer;
        }
        interface PointerEvent<T = Element> extends MouseEvent<T> {
            pointerId: number;
            pressure: number;
            pointerType: string;
            isPrimary: boolean;
        }
        interface FocusEvent<T = Element, R = Element> extends SyntheticEvent<T> {
            relatedTarget: (EventTarget & R) | null;
            target: EventTarget & T;
        }
        interface FormEvent<T = Element> extends SyntheticEvent<T> {}
        interface InvalidEvent<T = Element> extends SyntheticEvent<T> {
            target: EventTarget & T;
        }
        interface ChangeEvent<T = Element> extends SyntheticEvent<T> {
            target: EventTarget & T;
        }
        interface KeyboardEvent<T = Element> extends SyntheticEvent<T> {
            altKey: boolean;
            charCode: number;
            ctrlKey: boolean;
            code: string;
            key: string;
            keyCode: number;
            locale: string;
            location: number;
            metaKey: boolean;
            repeat: boolean;
            shiftKey: boolean;
            which: number;
            getModifierState(key: string): boolean;
        }
        interface MouseEvent<T = Element, E = any> extends SyntheticEvent<T, E> {
            altKey: boolean;
            button: number;
            buttons: number;
            clientX: number;
            clientY: number;
            ctrlKey: boolean;
            metaKey: boolean;
            movementX: number;
            movementY: number;
            pageX: number;
            pageY: number;
            relatedTarget: EventTarget | null;
            screenX: number;
            screenY: number;
            shiftKey: boolean;
            getModifierState(key: string): boolean;
        }
        interface TouchEvent<T = Element> extends SyntheticEvent<T> {
            altKey: boolean;
            changedTouches: TouchList;
            ctrlKey: boolean;
            metaKey: boolean;
            shiftKey: boolean;
            targetTouches: TouchList;
            touches: TouchList;
            getModifierState(key: string): boolean;
        }
        interface UIEvent<T = Element> extends SyntheticEvent<T> {
            detail: number;
            view: any;
        }
        interface WheelEvent<T = Element> extends MouseEvent<T> {
            deltaMode: number;
            deltaX: number;
            deltaY: number;
            deltaZ: number;
        }
        interface AnimationEvent<T = Element> extends SyntheticEvent<T> {
            animationName: string;
            elapsedTime: number;
            pseudoElement: string;
        }
        interface TransitionEvent<T = Element> extends SyntheticEvent<T> {
            elapsedTime: number;
            propertyName: string;
            pseudoElement: string;
        }

        type EventHandler<E extends SyntheticEvent<any>> = (event: E) => void;
        type ReactEventHandler<T = Element> = EventHandler<SyntheticEvent<T>>;
        type ClipboardEventHandler<T = Element> = EventHandler<ClipboardEvent<T>>;
        type CompositionEventHandler<T = Element> = EventHandler<CompositionEvent<T>>;
        type DragEventHandler<T = Element> = EventHandler<DragEvent<T>>;
        type FocusEventHandler<T = Element> = EventHandler<FocusEvent<T>>;
        type FormEventHandler<T = Element> = EventHandler<FormEvent<T>>;
        type ChangeEventHandler<T = Element> = EventHandler<ChangeEvent<T>>;
        type KeyboardEventHandler<T = Element> = EventHandler<KeyboardEvent<T>>;
        type MouseEventHandler<T = Element> = EventHandler<MouseEvent<T>>;
        type TouchEventHandler<T = Element> = EventHandler<TouchEvent<T>>;
        type PointerEventHandler<T = Element> = EventHandler<PointerEvent<T>>;
        type UIEventHandler<T = Element> = EventHandler<UIEvent<T>>;
        type WheelEventHandler<T = Element> = EventHandler<WheelEvent<T>>;
        type AnimationEventHandler<T = Element> = EventHandler<AnimationEvent<T>>;
        type TransitionEventHandler<T = Element> = EventHandler<TransitionEvent<T>>;

        // --------------------------------------------------------------
        // HTML attribute bags
        // --------------------------------------------------------------

        interface AriaAttributes {
            [ariaKey: \`aria-\${string}\`]: string | number | boolean | undefined;
            role?: string | undefined;
        }

        interface DOMAttributes<T> {
            children?: ReactNode | undefined;
            dangerouslySetInnerHTML?: { __html: string } | undefined;

            onCopy?: ClipboardEventHandler<T> | undefined;
            onCut?: ClipboardEventHandler<T> | undefined;
            onPaste?: ClipboardEventHandler<T> | undefined;

            onCompositionEnd?: CompositionEventHandler<T> | undefined;
            onCompositionStart?: CompositionEventHandler<T> | undefined;
            onCompositionUpdate?: CompositionEventHandler<T> | undefined;

            onFocus?: FocusEventHandler<T> | undefined;
            onBlur?: FocusEventHandler<T> | undefined;

            onChange?: FormEventHandler<T> | undefined;
            onBeforeInput?: FormEventHandler<T> | undefined;
            onInput?: FormEventHandler<T> | undefined;
            onReset?: FormEventHandler<T> | undefined;
            onSubmit?: FormEventHandler<T> | undefined;
            onInvalid?: FormEventHandler<T> | undefined;

            onLoad?: ReactEventHandler<T> | undefined;
            onError?: ReactEventHandler<T> | undefined;

            onKeyDown?: KeyboardEventHandler<T> | undefined;
            onKeyPress?: KeyboardEventHandler<T> | undefined;
            onKeyUp?: KeyboardEventHandler<T> | undefined;

            onClick?: MouseEventHandler<T> | undefined;
            onContextMenu?: MouseEventHandler<T> | undefined;
            onDoubleClick?: MouseEventHandler<T> | undefined;
            onDrag?: DragEventHandler<T> | undefined;
            onDragEnd?: DragEventHandler<T> | undefined;
            onDragEnter?: DragEventHandler<T> | undefined;
            onDragExit?: DragEventHandler<T> | undefined;
            onDragLeave?: DragEventHandler<T> | undefined;
            onDragOver?: DragEventHandler<T> | undefined;
            onDragStart?: DragEventHandler<T> | undefined;
            onDrop?: DragEventHandler<T> | undefined;
            onMouseDown?: MouseEventHandler<T> | undefined;
            onMouseEnter?: MouseEventHandler<T> | undefined;
            onMouseLeave?: MouseEventHandler<T> | undefined;
            onMouseMove?: MouseEventHandler<T> | undefined;
            onMouseOut?: MouseEventHandler<T> | undefined;
            onMouseOver?: MouseEventHandler<T> | undefined;
            onMouseUp?: MouseEventHandler<T> | undefined;

            onSelect?: ReactEventHandler<T> | undefined;

            onTouchCancel?: TouchEventHandler<T> | undefined;
            onTouchEnd?: TouchEventHandler<T> | undefined;
            onTouchMove?: TouchEventHandler<T> | undefined;
            onTouchStart?: TouchEventHandler<T> | undefined;

            onPointerDown?: PointerEventHandler<T> | undefined;
            onPointerMove?: PointerEventHandler<T> | undefined;
            onPointerUp?: PointerEventHandler<T> | undefined;
            onPointerCancel?: PointerEventHandler<T> | undefined;
            onPointerEnter?: PointerEventHandler<T> | undefined;
            onPointerLeave?: PointerEventHandler<T> | undefined;
            onPointerOver?: PointerEventHandler<T> | undefined;
            onPointerOut?: PointerEventHandler<T> | undefined;

            onScroll?: UIEventHandler<T> | undefined;
            onWheel?: WheelEventHandler<T> | undefined;

            onAnimationStart?: AnimationEventHandler<T> | undefined;
            onAnimationEnd?: AnimationEventHandler<T> | undefined;
            onAnimationIteration?: AnimationEventHandler<T> | undefined;

            onTransitionEnd?: TransitionEventHandler<T> | undefined;
        }

        interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
            accessKey?: string | undefined;
            className?: string | undefined;
            contentEditable?: boolean | "inherit" | undefined;
            contextMenu?: string | undefined;
            dir?: string | undefined;
            draggable?: boolean | undefined;
            hidden?: boolean | undefined;
            id?: string | undefined;
            lang?: string | undefined;
            placeholder?: string | undefined;
            slot?: string | undefined;
            spellCheck?: boolean | undefined;
            style?: CSSProperties | undefined;
            tabIndex?: number | undefined;
            title?: string | undefined;
            translate?: "yes" | "no" | undefined;

            inputMode?:
                | "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search"
                | undefined;
            is?: string | undefined;

            color?: string | undefined;
            itemProp?: string | undefined;
            itemScope?: boolean | undefined;
            itemType?: string | undefined;
            itemID?: string | undefined;
            itemRef?: string | undefined;
            results?: number | undefined;
            security?: string | undefined;
            unselectable?: "on" | "off" | undefined;

            [dataAttr: \`data-\${string}\`]: any;
        }

        type DetailedHTMLProps<E extends HTMLAttributes<T>, T> = ClassAttributes<T> & E;

        interface AnchorHTMLAttributes<T> extends HTMLAttributes<T> {
            download?: any;
            href?: string | undefined;
            hrefLang?: string | undefined;
            media?: string | undefined;
            ping?: string | undefined;
            rel?: string | undefined;
            target?: string | undefined;
            type?: string | undefined;
            referrerPolicy?: string | undefined;
        }
        interface AreaHTMLAttributes<T> extends HTMLAttributes<T> {
            alt?: string | undefined;
            coords?: string | undefined;
            download?: any;
            href?: string | undefined;
            hrefLang?: string | undefined;
            media?: string | undefined;
            rel?: string | undefined;
            shape?: string | undefined;
            target?: string | undefined;
        }
        interface AudioHTMLAttributes<T> extends MediaHTMLAttributes<T> {}
        interface BaseHTMLAttributes<T> extends HTMLAttributes<T> {
            href?: string | undefined;
            target?: string | undefined;
        }
        interface BlockquoteHTMLAttributes<T> extends HTMLAttributes<T> { cite?: string | undefined; }
        interface ButtonHTMLAttributes<T> extends HTMLAttributes<T> {
            autoFocus?: boolean | undefined;
            disabled?: boolean | undefined;
            form?: string | undefined;
            formAction?: string | undefined;
            formEncType?: string | undefined;
            formMethod?: string | undefined;
            formNoValidate?: boolean | undefined;
            formTarget?: string | undefined;
            name?: string | undefined;
            type?: "submit" | "reset" | "button" | undefined;
            value?: string | ReadonlyArray<string> | number | undefined;
        }
        interface CanvasHTMLAttributes<T> extends HTMLAttributes<T> {
            height?: number | string | undefined;
            width?: number | string | undefined;
        }
        interface ColHTMLAttributes<T> extends HTMLAttributes<T> { span?: number | undefined; width?: number | string | undefined; }
        interface ColgroupHTMLAttributes<T> extends HTMLAttributes<T> { span?: number | undefined; }
        interface DataHTMLAttributes<T> extends HTMLAttributes<T> { value?: string | ReadonlyArray<string> | number | undefined; }
        interface DetailsHTMLAttributes<T> extends HTMLAttributes<T> { open?: boolean | undefined; onToggle?: ReactEventHandler<T> | undefined; }
        interface DelHTMLAttributes<T> extends HTMLAttributes<T> { cite?: string | undefined; dateTime?: string | undefined; }
        interface DialogHTMLAttributes<T> extends HTMLAttributes<T> { open?: boolean | undefined; }
        interface EmbedHTMLAttributes<T> extends HTMLAttributes<T> {
            height?: number | string | undefined;
            src?: string | undefined;
            type?: string | undefined;
            width?: number | string | undefined;
        }
        interface FieldsetHTMLAttributes<T> extends HTMLAttributes<T> {
            disabled?: boolean | undefined;
            form?: string | undefined;
            name?: string | undefined;
        }
        interface FormHTMLAttributes<T> extends HTMLAttributes<T> {
            acceptCharset?: string | undefined;
            action?: string | undefined;
            autoComplete?: string | undefined;
            encType?: string | undefined;
            method?: string | undefined;
            name?: string | undefined;
            noValidate?: boolean | undefined;
            target?: string | undefined;
        }
        interface HtmlHTMLAttributes<T> extends HTMLAttributes<T> { manifest?: string | undefined; }
        interface IframeHTMLAttributes<T> extends HTMLAttributes<T> {
            allow?: string | undefined;
            allowFullScreen?: boolean | undefined;
            height?: number | string | undefined;
            loading?: "eager" | "lazy" | undefined;
            name?: string | undefined;
            referrerPolicy?: string | undefined;
            sandbox?: string | undefined;
            src?: string | undefined;
            srcDoc?: string | undefined;
            width?: number | string | undefined;
        }
        interface ImgHTMLAttributes<T> extends HTMLAttributes<T> {
            alt?: string | undefined;
            crossOrigin?: "anonymous" | "use-credentials" | "" | undefined;
            decoding?: "async" | "auto" | "sync" | undefined;
            height?: number | string | undefined;
            loading?: "eager" | "lazy" | undefined;
            referrerPolicy?: string | undefined;
            sizes?: string | undefined;
            src?: string | undefined;
            srcSet?: string | undefined;
            useMap?: string | undefined;
            width?: number | string | undefined;
        }
        interface InsHTMLAttributes<T> extends HTMLAttributes<T> { cite?: string | undefined; dateTime?: string | undefined; }
        interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
            accept?: string | undefined;
            alt?: string | undefined;
            autoComplete?: string | undefined;
            autoFocus?: boolean | undefined;
            capture?: boolean | "user" | "environment" | undefined;
            checked?: boolean | undefined;
            crossOrigin?: string | undefined;
            disabled?: boolean | undefined;
            form?: string | undefined;
            formAction?: string | undefined;
            formEncType?: string | undefined;
            formMethod?: string | undefined;
            formNoValidate?: boolean | undefined;
            formTarget?: string | undefined;
            height?: number | string | undefined;
            list?: string | undefined;
            max?: number | string | undefined;
            maxLength?: number | undefined;
            min?: number | string | undefined;
            minLength?: number | undefined;
            multiple?: boolean | undefined;
            name?: string | undefined;
            pattern?: string | undefined;
            placeholder?: string | undefined;
            readOnly?: boolean | undefined;
            required?: boolean | undefined;
            size?: number | undefined;
            src?: string | undefined;
            step?: number | string | undefined;
            type?: string | undefined;
            value?: string | ReadonlyArray<string> | number | undefined;
            width?: number | string | undefined;
            onChange?: ChangeEventHandler<T> | undefined;
        }
        interface KeygenHTMLAttributes<T> extends HTMLAttributes<T> {
            autoFocus?: boolean | undefined;
            challenge?: string | undefined;
            disabled?: boolean | undefined;
            form?: string | undefined;
            keyType?: string | undefined;
            keyParams?: string | undefined;
            name?: string | undefined;
        }
        interface LabelHTMLAttributes<T> extends HTMLAttributes<T> {
            form?: string | undefined;
            htmlFor?: string | undefined;
        }
        interface LiHTMLAttributes<T> extends HTMLAttributes<T> { value?: string | ReadonlyArray<string> | number | undefined; }
        interface LinkHTMLAttributes<T> extends HTMLAttributes<T> {
            as?: string | undefined;
            crossOrigin?: string | undefined;
            href?: string | undefined;
            hrefLang?: string | undefined;
            integrity?: string | undefined;
            media?: string | undefined;
            rel?: string | undefined;
            sizes?: string | undefined;
            type?: string | undefined;
        }
        interface MapHTMLAttributes<T> extends HTMLAttributes<T> { name?: string | undefined; }
        interface MenuHTMLAttributes<T> extends HTMLAttributes<T> { type?: string | undefined; }
        interface MediaHTMLAttributes<T> extends HTMLAttributes<T> {
            autoPlay?: boolean | undefined;
            controls?: boolean | undefined;
            controlsList?: string | undefined;
            crossOrigin?: string | undefined;
            loop?: boolean | undefined;
            mediaGroup?: string | undefined;
            muted?: boolean | undefined;
            playsInline?: boolean | undefined;
            preload?: string | undefined;
            src?: string | undefined;
        }
        interface MetaHTMLAttributes<T> extends HTMLAttributes<T> {
            charSet?: string | undefined;
            content?: string | undefined;
            httpEquiv?: string | undefined;
            name?: string | undefined;
        }
        interface MeterHTMLAttributes<T> extends HTMLAttributes<T> {
            form?: string | undefined;
            high?: number | undefined;
            low?: number | undefined;
            max?: number | string | undefined;
            min?: number | string | undefined;
            optimum?: number | undefined;
            value?: string | ReadonlyArray<string> | number | undefined;
        }
        interface ObjectHTMLAttributes<T> extends HTMLAttributes<T> {
            classID?: string | undefined;
            data?: string | undefined;
            form?: string | undefined;
            height?: number | string | undefined;
            name?: string | undefined;
            type?: string | undefined;
            useMap?: string | undefined;
            width?: number | string | undefined;
            wmode?: string | undefined;
        }
        interface OlHTMLAttributes<T> extends HTMLAttributes<T> {
            reversed?: boolean | undefined;
            start?: number | undefined;
            type?: "1" | "a" | "A" | "i" | "I" | undefined;
        }
        interface OptgroupHTMLAttributes<T> extends HTMLAttributes<T> { disabled?: boolean | undefined; label?: string | undefined; }
        interface OptionHTMLAttributes<T> extends HTMLAttributes<T> {
            disabled?: boolean | undefined;
            label?: string | undefined;
            selected?: boolean | undefined;
            value?: string | ReadonlyArray<string> | number | undefined;
        }
        interface OutputHTMLAttributes<T> extends HTMLAttributes<T> {
            form?: string | undefined;
            htmlFor?: string | undefined;
            name?: string | undefined;
        }
        interface ParamHTMLAttributes<T> extends HTMLAttributes<T> { name?: string | undefined; value?: string | ReadonlyArray<string> | number | undefined; }
        interface ProgressHTMLAttributes<T> extends HTMLAttributes<T> { max?: number | string | undefined; value?: string | ReadonlyArray<string> | number | undefined; }
        interface QuoteHTMLAttributes<T> extends HTMLAttributes<T> { cite?: string | undefined; }
        interface SlotHTMLAttributes<T> extends HTMLAttributes<T> { name?: string | undefined; }
        interface ScriptHTMLAttributes<T> extends HTMLAttributes<T> {
            async?: boolean | undefined;
            crossOrigin?: string | undefined;
            defer?: boolean | undefined;
            integrity?: string | undefined;
            noModule?: boolean | undefined;
            nonce?: string | undefined;
            src?: string | undefined;
            type?: string | undefined;
        }
        interface SelectHTMLAttributes<T> extends HTMLAttributes<T> {
            autoComplete?: string | undefined;
            autoFocus?: boolean | undefined;
            disabled?: boolean | undefined;
            form?: string | undefined;
            multiple?: boolean | undefined;
            name?: string | undefined;
            required?: boolean | undefined;
            size?: number | undefined;
            value?: string | ReadonlyArray<string> | number | undefined;
            onChange?: ChangeEventHandler<T> | undefined;
        }
        interface SourceHTMLAttributes<T> extends HTMLAttributes<T> {
            media?: string | undefined;
            sizes?: string | undefined;
            src?: string | undefined;
            srcSet?: string | undefined;
            type?: string | undefined;
        }
        interface StyleHTMLAttributes<T> extends HTMLAttributes<T> {
            media?: string | undefined;
            nonce?: string | undefined;
            scoped?: boolean | undefined;
            type?: string | undefined;
        }
        interface TableHTMLAttributes<T> extends HTMLAttributes<T> {
            cellPadding?: number | string | undefined;
            cellSpacing?: number | string | undefined;
            summary?: string | undefined;
            width?: number | string | undefined;
        }
        interface TdHTMLAttributes<T> extends HTMLAttributes<T> {
            align?: "left" | "center" | "right" | "justify" | "char" | undefined;
            colSpan?: number | undefined;
            headers?: string | undefined;
            rowSpan?: number | undefined;
            scope?: string | undefined;
            abbr?: string | undefined;
            height?: number | string | undefined;
            width?: number | string | undefined;
            valign?: "top" | "middle" | "bottom" | "baseline" | undefined;
        }
        interface TextareaHTMLAttributes<T> extends HTMLAttributes<T> {
            autoComplete?: string | undefined;
            autoFocus?: boolean | undefined;
            cols?: number | undefined;
            dirName?: string | undefined;
            disabled?: boolean | undefined;
            form?: string | undefined;
            maxLength?: number | undefined;
            minLength?: number | undefined;
            name?: string | undefined;
            placeholder?: string | undefined;
            readOnly?: boolean | undefined;
            required?: boolean | undefined;
            rows?: number | undefined;
            value?: string | ReadonlyArray<string> | number | undefined;
            wrap?: string | undefined;
            onChange?: ChangeEventHandler<T> | undefined;
        }
        interface ThHTMLAttributes<T> extends HTMLAttributes<T> {
            align?: "left" | "center" | "right" | "justify" | "char" | undefined;
            colSpan?: number | undefined;
            headers?: string | undefined;
            rowSpan?: number | undefined;
            scope?: string | undefined;
            abbr?: string | undefined;
        }
        interface TimeHTMLAttributes<T> extends HTMLAttributes<T> { dateTime?: string | undefined; }
        interface TrackHTMLAttributes<T> extends HTMLAttributes<T> {
            default?: boolean | undefined;
            kind?: string | undefined;
            label?: string | undefined;
            src?: string | undefined;
            srcLang?: string | undefined;
        }
        interface VideoHTMLAttributes<T> extends MediaHTMLAttributes<T> {
            height?: number | string | undefined;
            playsInline?: boolean | undefined;
            poster?: string | undefined;
            width?: number | string | undefined;
            disablePictureInPicture?: boolean | undefined;
            disableRemotePlayback?: boolean | undefined;
        }
    }

    namespace ReactDOM {
        /**
         * Mount a React tree into a DOM \`container\`, replacing its
         * children. The React 17-style entry point Bitburner exposes \u2014
         * on React 18+ apps use \`createRoot(container).render(element)\`
         * instead.
         *
         * @example
         *     ReactDOM.render(
         *         React.createElement(App),
         *         document.getElementById("root")
         *     );
         *
         * @see https://legacy.reactjs.org/docs/react-dom.html#render
         */
        function render(
            element: React.ReactElement,
            container: Element | DocumentFragment | null,
            callback?: () => void,
        ): void;
        /**
         * Like \`render\`, but for containers already populated by
         * server-side rendering. React attaches event handlers to the
         * existing markup instead of throwing it away.
         */
        function hydrate(
            element: React.ReactElement,
            container: Element | DocumentFragment | null,
            callback?: () => void,
        ): void;
        /**
         * Tear down a previously-rendered tree and clean up its handlers.
         * Returns \`true\` if there was a tree to remove.
         */
        function unmountComponentAtNode(container: Element | DocumentFragment): boolean;

        /**
         * Return the DOM node backing a class-component instance. Legacy \u2014
         * prefer refs (\`useRef\`, \`forwardRef\`) to talk to the DOM.
         */
        function findDOMNode(instance: React.Component<any, any> | Element | null | undefined): Element | null | Text;

        /**
         * Render \`children\` into a DOM node that isn't a descendant of the
         * current component's parent. Standard escape hatch for modals,
         * tooltips, and dropdowns that need to break out of overflow:hidden
         * or z-index stacking contexts.
         *
         * @example
         *     ReactDOM.createPortal(
         *         React.createElement("div", { className: "toast" }, "saved"),
         *         document.body
         *     );
         *
         * @see https://react.dev/reference/react-dom/createPortal
         */
        function createPortal(
            children: React.ReactNode,
            container: Element | DocumentFragment,
            key?: null | string,
        ): React.ReactPortal;

        /**
         * Force React to flush any pending updates queued inside \`fn\`
         * synchronously, before returning. Escape hatch \u2014 using this
         * regularly usually indicates a design problem.
         */
        function flushSync<R>(fn: () => R): R;
        function flushSync<A, R>(fn: (a: A) => R, a: A): R;

        function unstable_batchedUpdates<A, R>(callback: (a: A) => R, a: A): R;
        function unstable_batchedUpdates<R>(callback: () => R): R;

        const version: string;
    }

    // JSX namespace so \`<div />\`, \`<span className="\u2026" />\` etc. resolve in
    // .tsx files. Intrinsic elements are mapped to element-specific
    // attribute bags where they carry weight (input, button, form, \u2026) and
    // to a generic \`HTMLAttributes\` fallback for everything else. The
    // string-index signature at the top makes any unlisted tag still
    // typecheck as an HTML element \u2014 practical for the SVG grab-bag and
    // any future HTML additions.
    namespace JSX {
        interface Element extends React.ReactElement<any, any> {}
        interface ElementClass extends React.Component<any> {
            render(): React.ReactNode;
        }
        interface ElementAttributesProperty { props: {}; }
        interface ElementChildrenAttribute { children: {}; }
        interface IntrinsicAttributes extends React.Attributes {}
        interface IntrinsicClassAttributes<T> extends React.ClassAttributes<T> {}

        interface IntrinsicElements {
            [tagName: string]: React.DetailedHTMLProps<React.HTMLAttributes<any>, any>;

            a: React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>;
            area: React.DetailedHTMLProps<React.AreaHTMLAttributes<HTMLAreaElement>, HTMLAreaElement>;
            audio: React.DetailedHTMLProps<React.AudioHTMLAttributes<HTMLAudioElement>, HTMLAudioElement>;
            base: React.DetailedHTMLProps<React.BaseHTMLAttributes<HTMLBaseElement>, HTMLBaseElement>;
            blockquote: React.DetailedHTMLProps<React.BlockquoteHTMLAttributes<HTMLQuoteElement>, HTMLQuoteElement>;
            button: React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>;
            canvas: React.DetailedHTMLProps<React.CanvasHTMLAttributes<HTMLCanvasElement>, HTMLCanvasElement>;
            col: React.DetailedHTMLProps<React.ColHTMLAttributes<HTMLTableColElement>, HTMLTableColElement>;
            colgroup: React.DetailedHTMLProps<React.ColgroupHTMLAttributes<HTMLTableColElement>, HTMLTableColElement>;
            data: React.DetailedHTMLProps<React.DataHTMLAttributes<HTMLDataElement>, HTMLDataElement>;
            del: React.DetailedHTMLProps<React.DelHTMLAttributes<HTMLModElement>, HTMLModElement>;
            details: React.DetailedHTMLProps<React.DetailsHTMLAttributes<HTMLDetailsElement>, HTMLDetailsElement>;
            dialog: React.DetailedHTMLProps<React.DialogHTMLAttributes<HTMLDialogElement>, HTMLDialogElement>;
            div: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
            embed: React.DetailedHTMLProps<React.EmbedHTMLAttributes<HTMLEmbedElement>, HTMLEmbedElement>;
            fieldset: React.DetailedHTMLProps<React.FieldsetHTMLAttributes<HTMLFieldSetElement>, HTMLFieldSetElement>;
            form: React.DetailedHTMLProps<React.FormHTMLAttributes<HTMLFormElement>, HTMLFormElement>;
            h1: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            h2: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            h3: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            h4: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            h5: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            h6: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            hr: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHRElement>, HTMLHRElement>;
            iframe: React.DetailedHTMLProps<React.IframeHTMLAttributes<HTMLIFrameElement>, HTMLIFrameElement>;
            img: React.DetailedHTMLProps<React.ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>;
            input: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>;
            ins: React.DetailedHTMLProps<React.InsHTMLAttributes<HTMLModElement>, HTMLModElement>;
            label: React.DetailedHTMLProps<React.LabelHTMLAttributes<HTMLLabelElement>, HTMLLabelElement>;
            li: React.DetailedHTMLProps<React.LiHTMLAttributes<HTMLLIElement>, HTMLLIElement>;
            link: React.DetailedHTMLProps<React.LinkHTMLAttributes<HTMLLinkElement>, HTMLLinkElement>;
            map: React.DetailedHTMLProps<React.MapHTMLAttributes<HTMLMapElement>, HTMLMapElement>;
            meta: React.DetailedHTMLProps<React.MetaHTMLAttributes<HTMLMetaElement>, HTMLMetaElement>;
            meter: React.DetailedHTMLProps<React.MeterHTMLAttributes<HTMLMeterElement>, HTMLMeterElement>;
            object: React.DetailedHTMLProps<React.ObjectHTMLAttributes<HTMLObjectElement>, HTMLObjectElement>;
            ol: React.DetailedHTMLProps<React.OlHTMLAttributes<HTMLOListElement>, HTMLOListElement>;
            optgroup: React.DetailedHTMLProps<React.OptgroupHTMLAttributes<HTMLOptGroupElement>, HTMLOptGroupElement>;
            option: React.DetailedHTMLProps<React.OptionHTMLAttributes<HTMLOptionElement>, HTMLOptionElement>;
            output: React.DetailedHTMLProps<React.OutputHTMLAttributes<HTMLOutputElement>, HTMLOutputElement>;
            param: React.DetailedHTMLProps<React.ParamHTMLAttributes<HTMLParamElement>, HTMLParamElement>;
            progress: React.DetailedHTMLProps<React.ProgressHTMLAttributes<HTMLProgressElement>, HTMLProgressElement>;
            q: React.DetailedHTMLProps<React.QuoteHTMLAttributes<HTMLQuoteElement>, HTMLQuoteElement>;
            script: React.DetailedHTMLProps<React.ScriptHTMLAttributes<HTMLScriptElement>, HTMLScriptElement>;
            select: React.DetailedHTMLProps<React.SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement>;
            slot: React.DetailedHTMLProps<React.SlotHTMLAttributes<HTMLSlotElement>, HTMLSlotElement>;
            source: React.DetailedHTMLProps<React.SourceHTMLAttributes<HTMLSourceElement>, HTMLSourceElement>;
            style: React.DetailedHTMLProps<React.StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>;
            table: React.DetailedHTMLProps<React.TableHTMLAttributes<HTMLTableElement>, HTMLTableElement>;
            td: React.DetailedHTMLProps<React.TdHTMLAttributes<HTMLTableDataCellElement>, HTMLTableDataCellElement>;
            textarea: React.DetailedHTMLProps<React.TextareaHTMLAttributes<HTMLTextAreaElement>, HTMLTextAreaElement>;
            th: React.DetailedHTMLProps<React.ThHTMLAttributes<HTMLTableHeaderCellElement>, HTMLTableHeaderCellElement>;
            time: React.DetailedHTMLProps<React.TimeHTMLAttributes<HTMLTimeElement>, HTMLTimeElement>;
            track: React.DetailedHTMLProps<React.TrackHTMLAttributes<HTMLTrackElement>, HTMLTrackElement>;
            video: React.DetailedHTMLProps<React.VideoHTMLAttributes<HTMLVideoElement>, HTMLVideoElement>;
        }
    }
`,ks=`declare module "react" {
    export = React;
}
declare module "react-dom" {
    export = ReactDOM;
}
`;var Do=["**/NetscriptDefinitions.d.ts","**/NetscriptGlobals.d.ts",".git/**",".gitignore",".vscode/**","node_modules/**","tsconfig.json","package.json","package-lock.json"],I="NetscriptDefinitions.d.ts",Ae="NetscriptGlobals.d.ts",jt="@ns",Te=1024*1024,Hs=8*1024*1024,qt=5e3,zt="/trashbin",nt=class{constructor(e,t,n,i){this.api=e;this.config=t;this.memento=i;this.pathMapper=new be(t),this.outputChannel=n}api;config;memento;pathMapper;debounceTimers=new Map;outputChannel;pushListeners=[];async pushFile(e){if(this.config.fileExtensions.length===0){g.window.showWarningMessage("bitburnerSync.fileExtensions is set to []. Nothing will be synced. Remove the setting to fall back to the defaults.");return}if(this.isExcluded(e)){this.log(`Excluded from sync: ${e.fsPath}`);return}let t=-1;try{t=(await g.workspace.fs.stat(e)).size}catch{}if(t>Te)throw new Error(`File exceeds the ${Z(Te)} sync limit: ${e.fsPath} (${Z(t)})`);let n=this.pathMapper.mapToRemote(e),i=await g.workspace.fs.readFile(e);if(i.byteLength>Te)throw new Error(`File exceeds the ${Z(Te)} sync limit: ${e.fsPath} (${Z(i.byteLength)})`);let r=Buffer.from(i).toString("utf8");await this.api.pushFile(n,r,this.config.targetServer),this.log(`Pushed: ${n}`),this.config.showNotifications&&g.window.showInformationMessage(`Synced: ${n}`),this.emitPushed(n)}onDidPush(e){return this.pushListeners.push(e),{dispose:()=>{let t=this.pushListeners.indexOf(e);t>=0&&this.pushListeners.splice(t,1)}}}emitPushed(e){for(let t of this.pushListeners)try{t(e)}catch(n){this.log(`onDidPush listener threw: ${n instanceof Error?n.message:n}`)}}async syncAll(){if(this.config.fileExtensions.length===0){g.window.showWarningMessage("bitburnerSync.fileExtensions is set to []. Nothing will be synced. Remove the setting to fall back to the defaults.");return}let e=g.workspace.workspaceFolders?.[0];if(!e){g.window.showWarningMessage("No workspace folder open.");return}let t=new g.RelativePattern(e,this.config.fileGlob),n=this.findFilesExcludeGlob(),i=n?new g.RelativePattern(e,n):null,r=await g.workspace.findFiles(t,i);if(r.length===0){g.window.showWarningMessage("No matching files found to sync.");return}let o=0,a=0,l=0;for(let d of r){if(this.isExcluded(d)){l++,this.log(`Excluded from sync: ${d.fsPath}`);continue}try{await this.pushFile(d),o++}catch(f){a++,this.log(`Failed to push ${d.fsPath}: ${f}`)}}let c=l>0?`, ${l} excluded`:"",u=`Sync complete: ${o} pushed, ${a} failed${c}`;this.log(u),this.config.showNotifications&&g.window.showInformationMessage(u)}handleFileChange(e){if(!this.config.autoSync||this.isExcluded(e))return;let t=e.toString(),n=this.debounceTimers.get(t);n&&clearTimeout(n);let i=setTimeout(async()=>{if(this.debounceTimers.delete(t),!await this.fileExists(e)){this.log(`Auto-sync skipped (file no longer exists): ${e.fsPath}`);return}try{await this.pushFile(e)}catch(r){this.log(`Auto-sync failed for ${e.fsPath}: ${r}`)}},300);this.debounceTimers.set(t,i)}async deleteRemoteFile(e){if(this.config.fileExtensions.length===0)return;if(this.isExcluded(e)){this.log(`Excluded from delete-sync: ${e.fsPath}`);return}if(!this.matchesAllowedExtension(e))return;let t=this.pathMapper.mapToRemote(e);await this.api.deleteFile(t,this.config.targetServer),this.log(`Deleted: ${t}`),this.config.showNotifications&&g.window.showInformationMessage(`Deleted: ${t}`)}async moveToTrashbin(e){if(this.config.fileExtensions.length===0)return;if(this.isExcluded(e)){this.log(`Excluded from trashbin-move: ${e.fsPath}`);return}if(!this.matchesAllowedExtension(e))return;let t=this.pathMapper.mapToRemote(e),n=this.config.targetServer;if(Ds(t)){await this.api.deleteFile(t,n),this.log(`Deleted from trashbin: ${t}`),this.config.showNotifications&&g.window.showInformationMessage(`Deleted from trashbin: ${t}`);return}let i=zt+t,r;try{r=await this.api.getFile(t,n)}catch{this.log(`Trashbin move skipped: ${t} not found on ${n}`);return}await this.api.pushFile(i,r,n),await this.api.deleteFile(t,n),this.log(`Moved to trashbin: ${t} -> ${i}`),this.config.showNotifications&&g.window.showInformationMessage(`Moved to trashbin: ${t}`)}handleFileDelete(e){if(!this.config.autoSync)return;let t=e.toString(),n=this.debounceTimers.get(t);n&&(clearTimeout(n),this.debounceTimers.delete(t)),this.moveToTrashbin(e).catch(i=>{this.log(`Auto-trashbin failed for ${e.fsPath}: ${i}`)})}handleFileRename(e,t){if(!this.config.autoSync)return;let n=e.toString(),i=this.debounceTimers.get(n);i&&(clearTimeout(i),this.debounceTimers.delete(n)),(async()=>{try{await this.deleteRemoteFile(e)}catch(r){this.log(`Auto-delete (rename) failed for ${e.fsPath}: ${r}`)}if(this.matchesAllowedExtension(t))try{await this.fileExists(t)&&await this.pushFile(t)}catch(r){this.log(`Auto-sync (rename) failed for ${t.fsPath}: ${r}`)}})()}matchesAllowedExtension(e){let t=e.fsPath.lastIndexOf(".");if(t<0)return!1;let n=e.fsPath.slice(t).toLowerCase();return this.config.fileExtensions.includes(n)}async downloadAll(){return this.downloadFiles()}async downloadSelectedFiles(){let e=this.memento?.get("bitburnerSync.downloadSelectedFilesSelection")??"**/*.js",t=await g.window.showInputBox({title:"Specify files to download",prompt:"for example, 'scripts/**' for all files under the scripts folder, or '**/*.json' for all json files",value:e});if(t)return await this.memento?.update("bitburnerSync.downloadSelectedFilesSelection",t),this.downloadFiles(t)}async downloadFiles(e){if(this.config.fileExtensions.length===0){g.window.showWarningMessage("bitburnerSync.fileExtensions is set to []. Nothing will be downloaded. Remove the setting to fall back to the defaults.");return}let t=await this.buildDownloadPlan({inclusionPattern:e});if(t===null)return;let{entries:n,skipped:i}=t,r=!0,o=n.filter(f=>f.existing).map(f=>f.remote);o.length>0&&(r=await this.confirmOverwrite(o),r||this.log(`Overwrite declined: ${o.length} existing local file${o.length===1?"":"s"} kept; new files will still be downloaded`));let a=n.filter(f=>r||!f.existing);if(a.length===0&&i===0){g.window.showWarningMessage("Nothing to download.");return}let l=0,c=0;for(let{remote:f,destUri:p}of a)try{let m=await this.api.getFile(f,this.config.targetServer),h=Buffer.byteLength(m,"utf8");if(h>Te)throw new Error(`File exceeds the ${Z(Te)} sync limit (${Z(h)})`);await g.workspace.fs.writeFile(p,Buffer.from(m)),l++,this.log(`Downloaded: ${f}`)}catch(m){c++,this.log(`Failed to download ${f}: ${m}`)}let u=i>0?`, ${i} skipped`:"",d=`Download complete: ${l} downloaded, ${c} failed${u}`;this.log(d),this.config.showNotifications&&g.window.showInformationMessage(d)}async countNewRemoteFiles(){if(this.config.fileExtensions.length===0)return 0;let e=await this.buildDownloadPlan({silent:!0});return e===null?0:e.entries.filter(t=>!t.existing).length}async countNewLocalFiles(){if(this.config.fileExtensions.length===0)return 0;let e=g.workspace.workspaceFolders?.[0];if(!e)return 0;let t=await this.api.getFileNames(this.config.targetServer);if(t.length>qt)return 0;let n=new Set(t.map(Gt)),i=new g.RelativePattern(e,this.config.fileGlob),r=this.findFilesExcludeGlob(),o=r?new g.RelativePattern(e,r):null,a=await g.workspace.findFiles(i,o),l=0;for(let c of a){if(this.isExcluded(c))continue;let u;try{u=this.pathMapper.mapToRemote(c)}catch{continue}n.has(Gt(u))||l++}return l}async buildDownloadPlan(e={}){let t=!!e.silent,n=g.workspace.workspaceFolders;if(!n||n.length===0){if(t)return null;throw new Error("No workspace folder open")}let i=n[0].uri,r=this.config.syncDirectory,o=r?g.Uri.joinPath(i,r):i,a=await this.api.getFileNames(this.config.targetServer);if(a.length===0)return t||g.window.showWarningMessage("No files found on Bitburner server."),null;if(a.length>qt){if(!t){let d=`Refusing to download: server returned ${a.length} filenames (limit is ${qt}). This usually indicates a corrupt save or a buggy server. Narrow bitburnerSync.fileExtensions or contact the server admin.`;this.log(d),g.window.showErrorMessage(d)}return null}let l=this.config.fileExtensions,c=[],u=0;for(let d of a){try{Wt(d)}catch(m){u++,t||this.log(`Skipped (invalid name from server): ${JSON.stringify(d)} \u2014 ${m instanceof Error?m.message:m}`);continue}if(!Oo(d,l)||!No(d,e.inclusionPattern)){u++,t||this.log(`Skipped (extension not in bitburnerSync.fileExtensions): ${d}`);continue}if(Ds(Gt(d))){u++,t||this.log(`Skipped (in /trashbin/): ${d}`);continue}let f=d.startsWith("/")?d.slice(1):d,p=g.Uri.joinPath(o,f);c.push({remote:d,destUri:p,existing:await this.fileExists(p)})}return{entries:c,skipped:u}}async fileExists(e){try{return await g.workspace.fs.stat(e),!0}catch{return!1}}allExcludePatterns(){return[...Do,...this.config.exclude]}isExcluded(e){let t=g.workspace.workspaceFolders?.[0];if(!t)return!1;let n=st.relative(t.uri.fsPath,e.fsPath).replace(/\\/g,"/");return!n||n.startsWith("..")||st.isAbsolute(n)?!1:this.allExcludePatterns().some(i=>_(n,i,{dot:!0}))}findFilesExcludeGlob(){let e=this.allExcludePatterns();return e.length===0?null:e.length===1?e[0]:`{${e.join(",")}}`}async confirmOverwrite(e){let n=e.slice(0,20),i=e.length-n.length,r=n.join(`
`),o=i>0?`
\u2026and ${i} more`:"",a=e.length,l=a===1?"file":"files";return await g.window.showWarningMessage(`Overwrite ${a} local ${l}?`,{modal:!0,detail:`Downloading from Bitburner will replace the following ${l}:

${r}${o}

New files (not yet present locally) will be downloaded either way.`},"Overwrite")==="Overwrite"}async downloadDefinitions(){let e=await this.api.getDefinitionFile(),t=Buffer.byteLength(e,"utf8");if(t>Hs)throw new Error(`${I} exceeds the ${Z(Hs)} sanity limit (${Z(t)})`);let n=g.workspace.workspaceFolders;if(!n||n.length===0)throw new Error("No workspace folder open");let i=Os(e),r=n[0].uri,o=g.Uri.joinPath(r,I);await g.workspace.fs.writeFile(o,Buffer.from(i)),this.log(`Downloaded ${I}`),g.window.showInformationMessage(`Downloaded ${I} to workspace root.`),await this.writeGlobalsShim(r,i),await this.ensureTsConfig(r)}async ensureTypeDefinitionsSetup(){let e=g.workspace.workspaceFolders;if(!e||e.length===0)return;let t=e[0].uri,n=g.Uri.joinPath(t,I),i;try{let r=await g.workspace.fs.readFile(n);i=Buffer.from(r).toString("utf8")}catch{return}try{let r=Os(i);r!==i&&(await g.workspace.fs.writeFile(n,Buffer.from(r)),this.log(`Patched ${I} to export all top-level types`)),await this.writeGlobalsShim(t,r),await this.ensureTsConfig(t)}catch(r){this.log(`Type-definitions setup failed: ${r instanceof Error?r.message:r}`)}}async writeGlobalsShim(e,t){let n=Io(t);if(n.length===0){this.log(`Skipped ${Ae}: no top-level exports parsed from ${I}`);return}let i=Bo(n),r=g.Uri.joinPath(e,Ae);await g.workspace.fs.writeFile(r,Buffer.from(i)),this.log(`Wrote ${Ae} (${n.length} Netscript types globalized, React/ReactDOM inlined)`)}async ensureTsConfig(e){let t=g.Uri.joinPath(e,"tsconfig.json"),n;try{let a=await g.workspace.fs.readFile(t);n=Buffer.from(a).toString("utf8")}catch{}let i;if(n!==void 0)try{i=JSON.parse(n)}catch{}let r=i;if(r===void 0&&n!==void 0)try{r=JSON.parse(Fo(n))}catch{}let o=this.buildWantedTsconfig(r);if(n===void 0){await this.writeFreshTsConfig(t,o);return}if(i){$o(i,o)&&(await g.workspace.fs.writeFile(t,Buffer.from(JSON.stringify(i,null,2)+`
`)),this.log(`Updated tsconfig.json with ${o.files.join(", ")}, "${jt}" path alias, and jsx mode`));return}r&&Uo(r,o)||await this.warnManualTsConfigSetup(t,o,r===void 0)}buildWantedTsconfig(e){let t=e?.compilerOptions,n=!!t&&typeof t=="object"&&!Array.isArray(t)&&typeof t.baseUrl=="string",i=this.config.syncDirectory,r;if(n){let a=i?i.split("/").filter(Boolean).length:0,l="../".repeat(a);r={[jt]:[l+I],"@/*":["./*"]}}else{let a=i?`./${i}/*`:"./*";r={[jt]:[I],"@/*":[a]}}return{files:[I,Ae],paths:r,pathsToRemove:["react","react-dom"],compilerOptions:{jsx:"react"}}}async writeFreshTsConfig(e,t){let n=this.config.syncDirectory,i=n?`./${n}/*`:"./*",r={compilerOptions:{noImplicitAny:!1,target:"ESNext",module:"ESNext",moduleResolution:"bundler",allowImportingTsExtensions:!0,allowJs:!0,checkJs:!0,noEmit:!0,skipLibCheck:!0,esModuleInterop:!0,isolatedModules:!0,jsx:"react",paths:{...t.paths,"*":[i],"/*":[i]}},include:["**/*"],files:t.files};await g.workspace.fs.writeFile(e,Buffer.from(JSON.stringify(r,null,2)+`
`)),this.log("Created tsconfig.json")}async warnManualTsConfigSetup(e,t,n){let r=`${n?"tsconfig.json could not be parsed":"tsconfig.json appears to contain comments or trailing commas (JSONC), which the extension will not rewrite"}. Add the entries below manually to enable Netscript type hints.`;this.log(`WARN: ${r}`),this.log("Suggested tsconfig.json entries:"),this.log(`    "files": ${JSON.stringify(t.files)}`),this.log(`    "compilerOptions": { "paths": ${JSON.stringify(t.paths)}, ${Object.entries(t.compilerOptions).map(([c,u])=>`"${c}": ${JSON.stringify(u)}`).join(", ")} }`),t.pathsToRemove.length>0&&this.log(`    Also remove any stale entries from "compilerOptions.paths": ${JSON.stringify(t.pathsToRemove)} (they used to point into the extension install directory and break on upgrade \u2014 React/ReactDOM types now live in ${Ae}).`),this.log("See the Troubleshooting section of the README for a full example.");let o="Open tsconfig.json",a="Show Instructions",l=await g.window.showWarningMessage(r,o,a);l===o?await g.commands.executeCommand("vscode.open",e):l===a&&this.outputChannel.show()}dispose(){for(let e of this.debounceTimers.values())clearTimeout(e);this.debounceTimers.clear()}log(e){let t=new Date().toLocaleTimeString();this.outputChannel.appendLine(`[${t}] ${e}`)}};function Z(s){return s<0?"unknown size":s<1024?`${s} B`:s<1024*1024?`${(s/1024).toFixed(1)} KB`:`${(s/(1024*1024)).toFixed(1)} MB`}function Gt(s){return s.startsWith("/")?s:"/"+s}function Ds(s){return s===zt||s.startsWith(zt+"/")}function Oo(s,e){let t=s.lastIndexOf(".");return t<0?!1:e.includes(s.slice(t).toLowerCase())}function No(s,e){return e?_(s,e,{dot:!0}):!0}function Fo(s){let e="",t=0,n=!1,i="";for(;t<s.length;){let r=s[t],o=t+1<s.length?s[t+1]:"";if(n){if(r==="\\"&&t+1<s.length){e+=r+o,t+=2;continue}r===i&&(n=!1),e+=r,t++}else if(r==='"'||r==="'")n=!0,i=r,e+=r,t++;else if(r==="/"&&o==="/")for(;t<s.length&&s[t]!==`
`;)t++;else if(r==="/"&&o==="*"){for(t+=2;t+1<s.length&&!(s[t]==="*"&&s[t+1]==="/");)t++;t+=2}else if(r===","){let a=t+1;for(;a<s.length&&(s[a]===" "||s[a]==="	"||s[a]===`
`||s[a]==="\r");)a++;a<s.length&&(s[a]==="}"||s[a]==="]")||(e+=r),t++}else e+=r,t++}return e}function Os(s){return s.replace(/^(?:interface|type|enum|class|abstract\s+class)\s+\w+/gm,"export $&")}function Io(s){let e=new Set,t=[],n=/^export\s+(?:declare\s+)?(?:interface|type|enum|class|abstract\s+class)\s+(\w+)/gm,i;for(;(i=n.exec(s))!==null;){let r=i[1];e.has(r)||(e.add(r),t.push(r))}return t}function Bo(s){let e="./"+I.replace(/\.d\.ts$/,"");return["// AUTO-GENERATED by the Bitburner File Sync extension. DO NOT EDIT.","//","// Re-exports the Netscript API's top-level types into the global scope so","// you can write `function main(ns: NS)` without importing anything. The list",`// below is regenerated each time \`${I}\` is downloaded, so it`,"// stays in sync as Bitburner adds APIs.","//","// React and ReactDOM are also declared globally here because the Bitburner","// runtime exposes them implicitly. Their types are inlined below \u2014 a curated","// subset covering hooks, components, refs, memo/forwardRef/lazy, the event","// object hierarchy, HTMLAttributes, and the JSX intrinsic-element map. Users","// who need stricter typing can install @types/react into their workspace and","// let module augmentation replace these declarations.","",`import type * as _NS from "${e}";`,"","declare global {",...s.map(n=>`    type ${n} = _NS.${n};`),"",As,"}","",ks,"","export {};",""].join(`
`)}function $o(s,e){let t=!1,n=s.files;Array.isArray(n)||(n=[],s.files=n,t=!0);let i=n;for(let c of e.files)i.includes(c)||(i.push(c),t=!0);let r=s.compilerOptions;(!r||typeof r!="object"||Array.isArray(r))&&(r={},s.compilerOptions=r,t=!0);let o=r;for(let[c,u]of Object.entries(e.compilerOptions))o[c]===void 0&&(o[c]=u,t=!0);let a=o.paths;(!a||typeof a!="object"||Array.isArray(a))&&(a={},o.paths=a,t=!0);let l=a;for(let[c,u]of Object.entries(e.paths))Array.isArray(l[c])||(l[c]=u,t=!0);for(let c of e.pathsToRemove)c in l&&(delete l[c],t=!0);return t}function Uo(s,e){let t=s.files;if(!Array.isArray(t))return!1;for(let a of e.files)if(!t.includes(a))return!1;let n=s.compilerOptions;if(!n||typeof n!="object")return!1;let i=n;for(let a of Object.keys(e.compilerOptions))if(i[a]===void 0)return!1;let r=i.paths;if(!r||typeof r!="object")return!1;let o=r;for(let a of Object.keys(e.paths))if(!Array.isArray(o[a]))return!1;for(let a of e.pathsToRemove)if(a in o)return!1;return!0}var z=S(require("vscode")),it=class{constructor(e,t){this.syncEngine=e;this.config=t}syncEngine;config;fileWatcher=null;disposables=[];start(){if(this.stop(),this.config.fileExtensions.length===0)return;let e=z.workspace.workspaceFolders?.[0];if(!e)return;let t=new z.RelativePattern(e,this.config.fileGlob);this.fileWatcher=z.workspace.createFileSystemWatcher(t),this.fileWatcher.onDidChange(o=>{this.syncEngine.handleFileChange(o)},null,this.disposables),this.fileWatcher.onDidCreate(o=>{this.syncEngine.handleFileChange(o)},null,this.disposables);let n=z.workspace.onDidSaveTextDocument(o=>{this.matchesExtensions(o.uri)&&this.isInSyncDirectory(o.uri)&&this.syncEngine.handleFileChange(o.uri)});this.disposables.push(n);let i=z.workspace.onDidDeleteFiles(o=>{for(let a of o.files)this.matchesExtensions(a)&&this.isInSyncDirectory(a)&&this.syncEngine.handleFileDelete(a)});this.disposables.push(i);let r=z.workspace.onDidRenameFiles(o=>{for(let{oldUri:a,newUri:l}of o.files){let c=this.matchesExtensions(a)&&this.isInSyncDirectory(a),u=this.matchesExtensions(l)&&this.isInSyncDirectory(l);(c||u)&&this.syncEngine.handleFileRename(a,l)}});this.disposables.push(r)}isInSyncDirectory(e){let t=z.workspace.workspaceFolders?.[0];if(!t)return!1;let n=e.fsPath.replace(/\\/g,"/"),i=t.uri.fsPath.replace(/\\/g,"/"),r=this.config.syncDirectory,o=r?`${i}/${r}/`:`${i}/`;return n.startsWith(o)}stop(){this.fileWatcher&&(this.fileWatcher.dispose(),this.fileWatcher=null),this.disposables.forEach(e=>e.dispose()),this.disposables.length=0}matchesExtensions(e){let t=e.fsPath.lastIndexOf(".");if(t<0)return!1;let n=e.fsPath.slice(t).toLowerCase();return this.config.fileExtensions.includes(n)}dispose(){this.stop()}};var oe=S(require("vscode")),Wo={stopped:{text:"$(debug-stop) Bitburner: Off",tooltip:"Click to start sync server"},waiting:{text:"$(watch) Bitburner: Waiting",tooltip:"Server running, waiting for Bitburner to connect"},connected:{text:"$(check) Bitburner: Connected",tooltip:"Connected to Bitburner"},stale:{text:"$(warning) Bitburner: Stale",tooltip:"Bitburner has not responded to recent liveness checks; the socket is still open and will recover on any reply",color:new oe.ThemeColor("statusBarItem.warningBackground")},error:{text:"$(error) Bitburner: Error",tooltip:"Server error - click to retry",color:new oe.ThemeColor("statusBarItem.errorBackground")}},rt=class{item;constructor(){this.item=oe.window.createStatusBarItem(oe.StatusBarAlignment.Left,100),this.item.command="bitburnerSync.toggleServer",this.update("stopped"),this.item.show()}update(e){let t=Wo[e];this.item.text=t.text,this.item.tooltip=t.tooltip,this.item.backgroundColor=t.color}dispose(){this.item.dispose()}};var V=S(require("vscode"));var jo="Base cost",qo=new Set(["export","interface","class","type","enum","namespace","declare","function","const","let","var","abstract","readonly","public","private","protected","static","async"]);function Ns(s){let e=new Map,t=/\/\*\*((?:[^*]|\*(?!\/))*)\*\/\s*(\w+)\s*(?:\?|<|\()/g,n=/RAM cost:\s*([\d.]+)\s*GB/i,i;for(;(i=t.exec(s))!==null;){let r=i[1],o=i[2];if(qo.has(o))continue;let a=n.exec(r);if(!a)continue;let l=parseFloat(a[1]);if(!Number.isFinite(l)||l<0)continue;let c=e.get(o);(c===void 0||l>c)&&e.set(o,l)}return e}function ot(s,e){if(e.size===0)return{total:0,entries:[]};let t=new Map,n=c=>{if(t.has(c))return;let u=e.get(c);u!==void 0&&t.set(c,u)},i=/\.(\w+)/g,r=/\[\s*["'](\w+)["']\s*\]/g,o;for(;(o=i.exec(s))!==null;)n(o[1]);for(;(o=r.exec(s))!==null;)n(o[1]);let a=Array.from(t,([c,u])=>({name:c,cost:u}));return a.sort((c,u)=>u.cost-c.cost||c.name.localeCompare(u.name)),a.length>0&&a.push({name:jo,cost:1.6}),{total:a.reduce((c,u)=>c+u.cost,0),entries:a}}function at(s){return Number.isFinite(s)?`${(Math.round(s*100)/100).toFixed(2)} GB`:"?? GB"}var Vt="bitburnerSync.showRamCostBreakdown",Go=99,ct=class{item;constructor(){this.item=V.window.createStatusBarItem(V.StatusBarAlignment.Left,Go),this.item.command=Vt,this.item.hide()}update(e){if(e===void 0){this.item.hide();return}this.item.text=`$(chip) RAM: ${at(e)}`,this.item.tooltip="RAM cost reported by Bitburner for the file on the server. Click for the estimated per-method breakdown.",this.item.show()}dispose(){this.item.dispose()}};async function Fs(s){let e=V.window.activeTextEditor;if(!e){await V.window.showInformationMessage("Open a script to see its RAM cost breakdown.");return}let t=s.getCosts();if(t.size===0){await V.window.showInformationMessage('RAM cost table is empty. Connect to Bitburner (or run "Bitburner: Download Type Definitions") so the breakdown can be built.');return}let{total:n,entries:i}=ot(e.document.getText(),t);if(i.length===0){await V.window.showInformationMessage("No Netscript methods detected in the current file.");return}let r=i.length===1?"method":"methods";await V.window.showQuickPick(i.map(o=>({label:o.name,description:at(o.cost)})),{title:`Estimated RAM cost: ${at(n)} across ${i.length} unique ${r}`,placeHolder:"Highest cost first. Press Escape to close.",canPickMany:!1,matchOnDescription:!0})}var ae=S(require("vscode"));var zo=Ot,lt=class{constructor(e,t,n,i,r,o,a){this.outputChannel=e;this.onUpdate=t;this.api=n;this.config=i;this.wsServer=r;this.registry=a;this.pathMapper=new be(i),this.disposables.push(ae.window.onDidChangeActiveTextEditor(()=>{this.recompute()})),this.disposables.push(o.onDidPush(l=>{let c=this.activeRemotePath();c!==void 0&&c===l&&this.recompute()})),this.disposables.push(ae.workspace.onDidSaveTextDocument(l=>{if(this.wsServer.isConnected)return;let c=ae.window.activeTextEditor;c&&c.document.uri.toString()===l.uri.toString()&&this.recompute()})),this.disposables.push(a.onDidReload(()=>{this.recompute()})),this.onConnected=()=>{this.recompute()},this.onDisconnected=()=>{this.recompute()},this.wsServer.on("connected",this.onConnected),this.wsServer.on("disconnected",this.onDisconnected)}outputChannel;onUpdate;api;config;wsServer;registry;disposables=[];pathMapper;recomputeToken=0;onConnected;onDisconnected;async initialize(){await this.recompute()}async recompute(){let e=++this.recomputeToken,t=ae.window.activeTextEditor;if(!t||!Is(t.document)){this.onUpdate(void 0);return}if(!this.wsServer.isConnected){this.onUpdate(this.localScan(t.document));return}let n;try{n=this.pathMapper.mapToRemote(t.document.uri)}catch{this.onUpdate(void 0);return}try{let i=await this.api.calculateRam(n,this.config.targetServer);if(e!==this.recomputeToken)return;if(typeof i!="number"||!Number.isFinite(i)||i<0){this.onUpdate(void 0);return}this.onUpdate(i)}catch(i){if(e!==this.recomputeToken)return;this.outputChannel.appendLine(`calculateRam(${n}) failed: ${i instanceof Error?i.message:i}`),this.onUpdate(void 0)}}activeRemotePath(){let e=ae.window.activeTextEditor;if(!(!e||!Is(e.document)))try{return this.pathMapper.mapToRemote(e.document.uri)}catch{return}}localScan(e){let t=this.registry.getCosts();if(t.size===0)return;let{total:n,entries:i}=ot(e.getText(),t);if(i.length!==0)return n}dispose(){this.wsServer.off("connected",this.onConnected),this.wsServer.off("disconnected",this.onDisconnected);for(let e of this.disposables)e.dispose();this.disposables.length=0}};function Is(s){let e=s.uri.fsPath.toLowerCase(),t=e.lastIndexOf(".");if(t<0)return!1;let n=e.slice(t);return zo.includes(n)}var J=S(require("vscode"));var Bs="NetscriptDefinitions.d.ts",dt=class{constructor(e){this.outputChannel=e;let t=J.workspace.workspaceFolders?.[0];if(!t)return;let n=new J.RelativePattern(t,Bs),i=J.workspace.createFileSystemWatcher(n),r=()=>{this.reload()};i.onDidCreate(r,null,this.disposables),i.onDidChange(r,null,this.disposables),i.onDidDelete(()=>{this.costs=new Map,this.fireReload()},null,this.disposables),this.disposables.push(i)}outputChannel;costs=new Map;disposables=[];reloadListeners=[];async initialize(){await this.reload()}getCosts(){return this.costs}onDidReload(e){return this.reloadListeners.push(e),{dispose:()=>{let t=this.reloadListeners.indexOf(e);t>=0&&this.reloadListeners.splice(t,1)}}}fireReload(){for(let e of this.reloadListeners)try{e()}catch(t){this.outputChannel.appendLine(`NetscriptCostRegistry reload listener threw: ${t instanceof Error?t.message:t}`)}}async reload(){let e=J.workspace.workspaceFolders?.[0];if(!e){this.costs=new Map,this.fireReload();return}let t=J.Uri.joinPath(e.uri,Bs);try{let n=await J.workspace.fs.readFile(t),i=Buffer.from(n).toString("utf8");this.costs=Ns(i),this.outputChannel.appendLine(`RAM cost table loaded: ${this.costs.size} Netscript methods`)}catch{this.costs=new Map}this.fireReload()}dispose(){for(let e of this.disposables)e.dispose();this.disposables.length=0}};var w,Jt,Kt,B,P,ut,Xt,Yt,Zt,ke,C,$s="bitburnerSync.hasOpenedConfigOnFirstInstall",Us="bitburnerSync.hasConnectedBefore";async function De(){if(w.state!=="stopped"&&w.state!=="error"){b.window.showInformationMessage("Sync server is already running.");return}try{await w.start(B.port),ut.start(),b.window.showInformationMessage(`In-game under Options->Remote API, enter port ${B.port} and hit Connect.`),b.window.showInformationMessage(`Bitburner sync server started on port ${B.port}.`)}catch(s){b.window.showErrorMessage(`Failed to start server: ${s}`)}}async function Qt(){ut.stop(),await w.stop(),b.window.showInformationMessage("Bitburner sync server stopped.")}async function He(){w.state==="stopped"&&await De()}function Vo(s){C=b.window.createOutputChannel("Bitburner Sync"),B=new Qe,Yo(C),Ws(C,B),w=new Xe,Jt=new Ye(w),Kt=new Ze(Jt,B.targetServer),P=new nt(Kt,B,C,s.workspaceState),ut=new it(P,B),Xt=new rt,Yt=new ct,ke=new dt(C),Zt=new lt(C,e=>Yt.update(e),Kt,B,w,P,ke),w.on("stateChanged",e=>{Xt.update(e)}),w.on("error",e=>{C.appendLine(`WebSocket server error: ${e instanceof Error?e.message:e}`)}),w.on("connected",async()=>{if(C.appendLine("Bitburner connected."),B.autoDownloadDefinitions)try{await P.downloadDefinitions()}catch(e){C.appendLine(`Auto-download definitions failed: ${e}`)}await Ko(s)}),w.on("disconnected",()=>{C.appendLine("Bitburner disconnected.")}),w.on("rejected",()=>{C.appendLine("Refused a new Bitburner connection: the existing one is still live.")}),s.subscriptions.push(b.commands.registerCommand("bitburnerSync.startServer",De),b.commands.registerCommand("bitburnerSync.stopServer",Qt),b.commands.registerCommand("bitburnerSync.toggleServer",()=>w.state==="stopped"||w.state==="error"?De():Qt()),b.commands.registerCommand("bitburnerSync.syncFile",async()=>{let e=b.window.activeTextEditor;if(!e){b.window.showWarningMessage("No active file to sync.");return}if(await He(),!w.isConnected){b.window.showWarningMessage("Not connected to Bitburner.");return}try{await P.pushFile(e.document.uri)}catch(t){b.window.showErrorMessage(`Sync failed: ${t}`)}}),b.commands.registerCommand("bitburnerSync.syncAll",async()=>{if(await He(),!w.isConnected){b.window.showWarningMessage("Not connected to Bitburner.");return}try{await P.syncAll()}catch(e){b.window.showErrorMessage(`Sync all failed: ${e}`)}}),b.commands.registerCommand("bitburnerSync.getDefinitions",async()=>{if(await He(),!w.isConnected){b.window.showWarningMessage("Not connected to Bitburner.");return}try{await P.downloadDefinitions()}catch(e){b.window.showErrorMessage(`Failed to download definitions: ${e}`)}}),b.commands.registerCommand("bitburnerSync.downloadAll",async()=>{if(await He(),!w.isConnected){b.window.showWarningMessage("Not connected to Bitburner.");return}try{await P.downloadAll()}catch(e){b.window.showErrorMessage(`Failed to download files: ${e}`)}}),b.commands.registerCommand("bitburnerSync.downloadSelectedFiles",async()=>{if(await He(),!w.isConnected){b.window.showWarningMessage("Not connected to Bitburner.");return}try{await P.downloadSelectedFiles()}catch(e){b.window.showErrorMessage(`Failed to download files: ${e}`)}}),b.commands.registerCommand(Vt,()=>Fs(ke)),C,Xt,Yt,{dispose:()=>ke.dispose()},{dispose:()=>Zt.dispose()},{dispose:()=>P.dispose()},{dispose:()=>ut.dispose()},{dispose:()=>Jt.dispose()},{dispose:()=>w.stop()}),s.subscriptions.push(b.workspace.onDidChangeConfiguration(async e=>{e.affectsConfiguration("bitburnerSync")&&(e.affectsConfiguration("bitburnerSync.syncDirectory")&&Ws(C,B),w.state!=="stopped"&&(C.appendLine("Configuration changed, restarting sync server..."),await Qt(),await De()))})),B.autoStart&&De(),Jo(s),P.ensureTypeDefinitionsSetup(),ke.initialize().then(()=>Zt.initialize())}async function Jo(s){if(!s.globalState.get($s,!1)){await s.globalState.update($s,!0);try{await b.commands.executeCommand("workbench.action.openSettings","@ext:bitburner-file-sync-plugin")}catch(e){C.appendLine(`Could not open settings UI: ${e}`)}}}async function Ko(s){if(!s.workspaceState.get(Us,!1)){await s.workspaceState.update(Us,!0);try{let e=await P.countNewRemoteFiles();if(e>0){let r=e===1?"script":"scripts";await b.window.showInformationMessage(`Bitburner has ${e} ${r} not in this workspace. Download them now?`,"Download","Not now")==="Download"&&await P.downloadAll();return}let t=await P.countNewLocalFiles();if(t<=0)return;let n=t===1?"script":"scripts";await b.window.showInformationMessage(`This workspace has ${t} ${n} not in Bitburner. Sync them now?`,"Sync","Not now")==="Sync"&&await P.syncAll()}catch(e){C.appendLine(`First-connect sync prompt failed: ${e}`)}}}function Xo(){}function Yo(s){let e=b.workspace.workspaceFolders;if(!e||e.length<=1)return;let t=e[0],n=`Bitburner Sync: multi-root workspace detected (${e.length} folders). Only "${t.name}" (${t.uri.fsPath}) will be synced; files in other folders are ignored.`;s.appendLine(n),b.window.showWarningMessage(n)}function Ws(s,e){let t=e.syncDirectoryError();t&&(s.appendLine(t),b.window.showWarningMessage(t))}0&&(module.exports={activate,deactivate});
