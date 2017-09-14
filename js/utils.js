String.prototype.pad = function(_char, len, to) {
	if (!this || !_char || this.length >= len)	return this;
	to = to || 0;
	var ret = this;
	var max = (len - this.length) / _char.length + 1;
	while (--max) ret = (to) ? ret + _char : _char + ret;
	return ret;
};
function isString (obj) {
  return (Object.prototype.toString.call(obj) === '[object String]');
}
function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}
