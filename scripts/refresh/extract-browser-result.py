# Extracts a JSON.stringify(...)+"x"*N result saved by the browser tool into a JSON file.
import json, sys
src, dst = sys.argv[1], sys.argv[2]
d = json.load(open(src))
text = d[0]["text"] if isinstance(d, list) else d
s, _ = json.JSONDecoder().raw_decode(text.lstrip())
res = json.loads(s.rstrip("x"))
json.dump(res, open(dst, "w"))
print(dst, len(res))
