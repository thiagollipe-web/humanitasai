import js
AREAS={"Sociologia":["sociedade","sociologia","social","weber","durkheim","marx"],"Filosofia":["filosofia","ética","epistemologia","ontologia","kant","platão"],"História":["história","histórico","revolução","império","guerra","colonial"],"Ciência Política":["política","estado","poder","democracia","governo","eleição"],"Antropologia":["antropologia","cultura","etnografia","ritual","parentesco"],"Geografia":["geografia","território","espaço","paisagem","região","urbano"]}
def analyze(text):
 t=text.lower(); scores={a:sum(w in t for w in ws) for a,ws in AREAS.items()}; area=max(scores,key=scores.get)
 if scores[area]==0: area="Ciências Humanas"
 terms=[w.strip(".,;:!?()[]{}\"'") for w in text.split() if len(w.strip(".,;:!?()[]{}\"'"))>=4]
 return {"area":area,"terms":terms[:12]}
async def analyze_async(text): return analyze(text)
js.humanitasNLP=js.Object.new()
js.humanitasNLP.analyze=analyze_async