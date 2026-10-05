# Extracts a JSON.stringify(...)+"x"*N result saved by the browser tool into a JSON file.
# With a third argument (a site name), wraps it as { site: results } for
# results keyed by URL, e.g. prices-footballticketnet.json.
import json, sys
src, dst = sys.argv[1], sys.argv[2]
d = json.load(open(src))
text = d[0]["text"] if isinstance(d, list) else d
s, _ = json.JSONDecoder().raw_decode(text.lstrip())
res = json.loads(s.rstrip("x"))
if len(sys.argv) > 3:
    res = {sys.argv[3]: res}
json.dump(res, open(dst, "w"))
print(dst, len(res if len(sys.argv) <= 3 else res[sys.argv[3]]))
