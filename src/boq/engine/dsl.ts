// ─────────────────────────────────────────────────────────────
// Safe, deterministic expression evaluator for the parametric rule engine.
// NO eval / Function. Whitelisted grammar only: numbers, strings, vars,
// + - * / %, comparisons, && || !, ternary ?:, and math functions.
// This is what keeps the BOQ math auditable and injection-safe.
// ─────────────────────────────────────────────────────────────

export type Scalar = number | string | boolean;
export type Scope = Record<string, Scalar>;

type Tok =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string }
  | { t: 'punc'; v: string };

const OPS = ['<=', '>=', '==', '!=', '&&', '||', '<', '>', '+', '-', '*', '/', '%', '!'];

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const isIdStart = (c: string) => /[A-Za-z_]/.test(c);
  const isId = (c: string) => /[A-Za-z0-9_]/.test(c);
  const isDigit = (c: string) => /[0-9]/.test(c);
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
    if (c === '"' || c === "'") {
      const q = c; i++; let s = '';
      while (i < src.length && src[i] !== q) { s += src[i++]; }
      i++; out.push({ t: 'str', v: s }); continue;
    }
    if (isDigit(c) || (c === '.' && isDigit(src[i + 1]))) {
      let n = ''; while (i < src.length && /[0-9.]/.test(src[i])) n += src[i++];
      out.push({ t: 'num', v: parseFloat(n) }); continue;
    }
    if (isIdStart(c)) {
      let s = ''; while (i < src.length && isId(src[i])) s += src[i++];
      out.push({ t: 'id', v: s }); continue;
    }
    if (c === '(' || c === ')' || c === ',' || c === '?' || c === ':') {
      out.push({ t: 'punc', v: c }); i++; continue;
    }
    const two = src.slice(i, i + 2);
    const matched = OPS.find((op) => op.length === 2 && op === two) ?? OPS.find((op) => op.length === 1 && op === c);
    if (matched) { out.push({ t: 'op', v: matched }); i += matched.length; continue; }
    throw new Error(`DSL: unexpected character '${c}' in "${src}"`);
  }
  return out;
}

const FUNCS: Record<string, (args: number[]) => number> = {
  min: (a) => Math.min(...a),
  max: (a) => Math.max(...a),
  ceil: (a) => Math.ceil(a[0]),
  floor: (a) => Math.floor(a[0]),
  round: (a) => Math.round(a[0]),
  sqrt: (a) => Math.sqrt(a[0]),
  abs: (a) => Math.abs(a[0]),
  clamp: (a) => Math.min(Math.max(a[0], a[1]), a[2]),
  pow: (a) => Math.pow(a[0], a[1]),
};

class Parser {
  toks: Tok[]; pos = 0; scope: Scope;
  constructor(toks: Tok[], scope: Scope) { this.toks = toks; this.scope = scope; }
  peek() { return this.toks[this.pos]; }
  next() { return this.toks[this.pos++]; }
  eat(v: string) {
    const t = this.next();
    if (!t || (t.t !== 'op' && t.t !== 'punc') || t.v !== v) throw new Error(`DSL: expected '${v}'`);
  }

  parse(): Scalar {
    const v = this.ternary();
    if (this.pos < this.toks.length) throw new Error('DSL: trailing tokens');
    return v;
  }
  ternary(): Scalar {
    const cond = this.logicOr();
    if (this.peek() && this.peek().t === 'punc' && this.peek().v === '?') {
      this.eat('?');
      const a = this.ternary();
      this.eat(':');
      const b = this.ternary();
      return truthy(cond) ? a : b;
    }
    return cond;
  }
  logicOr(): Scalar {
    let l = this.logicAnd();
    while (this.isOp('||')) { this.next(); const r = this.logicAnd(); l = truthy(l) || truthy(r); }
    return l;
  }
  logicAnd(): Scalar {
    let l = this.equality();
    while (this.isOp('&&')) { this.next(); const r = this.equality(); l = truthy(l) && truthy(r); }
    return l;
  }
  equality(): Scalar {
    let l = this.comparison();
    while (this.isOp('==') || this.isOp('!=')) {
      const op = this.next().v; const r = this.comparison();
      l = op === '==' ? eq(l, r) : !eq(l, r);
    }
    return l;
  }
  comparison(): Scalar {
    let l = this.additive();
    while (this.isOp('<') || this.isOp('>') || this.isOp('<=') || this.isOp('>=')) {
      const op = this.next().v; const r = num(this.additive()); const ln = num(l);
      l = op === '<' ? ln < r : op === '>' ? ln > r : op === '<=' ? ln <= r : ln >= r;
    }
    return l;
  }
  additive(): Scalar {
    let l = this.multiplicative();
    while (this.isOp('+') || this.isOp('-')) {
      const op = this.next().v; const r = num(this.multiplicative());
      l = op === '+' ? num(l) + r : num(l) - r;
    }
    return l;
  }
  multiplicative(): Scalar {
    let l = this.unary();
    while (this.isOp('*') || this.isOp('/') || this.isOp('%')) {
      const op = this.next().v; const r = num(this.unary()); const ln = num(l);
      l = op === '*' ? ln * r : op === '/' ? (r === 0 ? 0 : ln / r) : ln % r;
    }
    return l;
  }
  unary(): Scalar {
    if (this.isOp('!')) { this.next(); return !truthy(this.unary()); }
    if (this.isOp('-')) { this.next(); return -num(this.unary()); }
    return this.primary();
  }
  primary(): Scalar {
    const t = this.next();
    if (!t) throw new Error('DSL: unexpected end');
    if (t.t === 'num') return t.v;
    if (t.t === 'str') return t.v;
    if (t.t === 'punc' && t.v === '(') { const v = this.ternary(); this.eat(')'); return v; }
    if (t.t === 'id') {
      if (t.v === 'true') return true;
      if (t.v === 'false') return false;
      // function call?
      if (this.peek() && this.peek().t === 'punc' && this.peek().v === '(') {
        this.eat('(');
        const args: number[] = [];
        if (!(this.peek() && this.peek().t === 'punc' && this.peek().v === ')')) {
          args.push(num(this.ternary()));
          while (this.peek() && this.peek().t === 'punc' && this.peek().v === ',') { this.eat(','); args.push(num(this.ternary())); }
        }
        this.eat(')');
        const fn = FUNCS[t.v];
        if (!fn) throw new Error(`DSL: unknown function '${t.v}'`);
        return fn(args);
      }
      if (t.v in this.scope) return this.scope[t.v];
      throw new Error(`DSL: unknown variable '${t.v}'`);
    }
    throw new Error(`DSL: unexpected token '${(t as any).v}'`);
  }
  isOp(v: string) { const t = this.peek(); return !!t && t.t === 'op' && t.v === v; }
}

function truthy(v: Scalar): boolean { return typeof v === 'boolean' ? v : typeof v === 'number' ? v !== 0 : v !== ''; }
function num(v: Scalar): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = parseFloat(v); return isNaN(n) ? 0 : n;
}
function eq(a: Scalar, b: Scalar): boolean {
  if (typeof a === 'number' || typeof b === 'number') return num(a) === num(b);
  return String(a) === String(b);
}

/** Evaluate an expression to any scalar. Returns a fallback on error (never throws to UI). */
export function evaluate(expr: string, scope: Scope): Scalar {
  try {
    return new Parser(tokenize(expr), scope).parse();
  } catch {
    return 0;
  }
}

/** Evaluate to a number (quantities). */
export function evalNumber(expr: string, scope: Scope): number {
  return num(evaluate(expr, scope));
}

/** Evaluate a condition to a boolean (null/empty = always true). */
export function evalCondition(expr: string | null | undefined, scope: Scope): boolean {
  if (!expr || expr.trim() === '') return true;
  return truthy(evaluate(expr, scope));
}
