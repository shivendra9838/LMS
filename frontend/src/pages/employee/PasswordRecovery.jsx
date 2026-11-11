import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Lock, 
  Mail, 
  Send, 
  ArrowLeft, 
  KeyRound, 
  Eye, 
  EyeOff, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2 
} from 'lucide-react';
import toast from 'react-hot-toast';
import BrandLogo from '../../components/BrandLogo';
import api from '../../services/api';

export default function PasswordRecovery({ reset = false, role = 'EMPLOYEE', setup = false }) {
  const navigate = useNavigate();
  const token = useRef(reset ? new URLSearchParams(window.location.hash.slice(1)).get('token') || '' : '');
  const inFlight = useRef(false);
  
  const [challenge, setChallenge] = useState('');
  const [code, setCode] = useState('');
  const collecting = reset || Boolean(challenge);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cooldown, setCooldown] = useState(0);
  
  const validToken = /^[a-f0-9]{64}$/.test(token.current);

  useEffect(() => {
    if (reset && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [reset]);

  // 60-second OTP resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const generate = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const generated = Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('') + 'Aa1!';
    setPassword(generated);
    setConfirmation(generated);
    setShow(true);
    setError('');
  };

  async function handleResendOtp() {
    if (inFlight.current || busy || cooldown > 0 || !email) return;
    setError('');
    setBusy(true);
    inFlight.current = true;
    try {
      const response = await api.post(
        `/auth/${role.toLowerCase()}/otp/request`,
        { email: email.trim() },
        { timeout: 20000 }
      );
      if (response.data?.data?.challenge) {
        setChallenge(response.data.data.challenge);
      }
      setCooldown(60);
      toast.success('A new 6-digit OTP code has been sent to your email.');
    } catch (failure) {
      setError(
        failure.response?.data?.errors?.[0]?.msg ||
        failure.response?.data?.message ||
        'Cannot resend OTP. Please check your connection and try again.'
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (inFlight.current) return;
    setError('');
    
    if (collecting && password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    
    inFlight.current = true;
    setBusy(true);
    try {
      const endpoint = `/auth/${role.toLowerCase()}/${reset ? 'reset-password' : challenge ? 'otp/reset' : 'otp/request'}`;
      const payload = reset 
        ? { token: token.current, password, confirmPassword: confirmation }
        : challenge 
          ? { challenge, code, password, confirmPassword: confirmation }
          : { email: email.trim() };

      const response = await api.post(endpoint, payload, { timeout: 20000 });

      if (!collecting) {
        setChallenge(response.data.data.challenge);
        setCooldown(60);
        setError('');
        return;
      }

      setSuccess(response.data.message || 'Password successfully updated.');
      setPassword('');
      setConfirmation('');
      if (reset) token.current = '';
      toast.success(setup ? 'Password set. Sign in with your new password.' : 'Password updated. Sign in with your new password.');
      navigate(`/${role.toLowerCase()}/login`, { replace: true });
    } catch (failure) {
      setError(
        failure.response?.data?.errors?.[0]?.msg ||
        failure.response?.data?.message ||
        'Cannot reach the server. Please check your connection and try again.'
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen bg-[#080F14] text-gray-100 flex flex-col items-center justify-center px-4 py-6 sm:py-10 overflow-x-hidden selection:bg-[#d4af37]/30 selection:text-white">
      {/* Decorative Gold Ribbon Curves — Top-Left */}
      <svg
        className="pointer-events-none absolute top-0 left-0 w-[340px] sm:w-[520px] md:w-[680px] h-[260px] sm:h-[380px] md:h-[480px] opacity-60 z-0"
        viewBox="0 0 700 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="goldCurveTL" x1="0%" y1="0%" x2="100%" y2="80%">
            <stop offset="0%" stopColor="#f7e092" stopOpacity="0.85" />
            <stop offset="35%" stopColor="#d4af37" stopOpacity="0.65" />
            <stop offset="70%" stopColor="#aa7c11" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#8d6b1d" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M -60,40 C 140,10 260,130 400,100 C 520,75 600,150 680,110" stroke="url(#goldCurveTL)" strokeWidth="1.2" />
        <path d="M -60,80 C 130,40 240,160 390,125 C 510,95 580,190 660,150" stroke="url(#goldCurveTL)" strokeWidth="1.5" opacity="0.9" />
        <path d="M -60,120 C 120,70 230,190 370,155 C 490,125 570,220 640,185" stroke="url(#goldCurveTL)" strokeWidth="1.2" opacity="0.8" />
        <path d="M -60,160 C 110,100 220,220 360,180 C 480,150 550,250 620,220" stroke="url(#goldCurveTL)" strokeWidth="1" opacity="0.6" />
        <path d="M -60,200 C 100,130 200,250 340,210 C 460,175 530,280 600,250" stroke="url(#goldCurveTL)" strokeWidth="0.8" opacity="0.45" />
      </svg>

      {/* Decorative Gold Ribbon Curves — Bottom-Right */}
      <svg
        className="pointer-events-none absolute bottom-0 right-0 w-[340px] sm:w-[520px] md:w-[680px] h-[260px] sm:h-[380px] md:h-[480px] opacity-60 z-0"
        viewBox="0 0 700 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="goldCurveBR" x1="100%" y1="100%" x2="0%" y2="20%">
            <stop offset="0%" stopColor="#f7e092" stopOpacity="0.85" />
            <stop offset="35%" stopColor="#d4af37" stopOpacity="0.65" />
            <stop offset="70%" stopColor="#aa7c11" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#8d6b1d" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M 760,460 C 560,490 440,370 300,400 C 180,425 100,350 20,390" stroke="url(#goldCurveBR)" strokeWidth="1.2" />
        <path d="M 760,420 C 570,460 450,340 310,375 C 190,405 120,310 40,350" stroke="url(#goldCurveBR)" strokeWidth="1.5" opacity="0.9" />
        <path d="M 760,380 C 580,430 460,310 330,345 C 210,375 130,280 60,315" stroke="url(#goldCurveBR)" strokeWidth="1.2" opacity="0.8" />
        <path d="M 760,340 C 590,400 480,280 340,320 C 220,350 150,250 80,280" stroke="url(#goldCurveBR)" strokeWidth="1" opacity="0.6" />
        <path d="M 760,300 C 600,370 500,250 360,290 C 240,325 170,220 100,250" stroke="url(#goldCurveBR)" strokeWidth="0.8" opacity="0.45" />
      </svg>

      {/* Subtle radial center ambient warmth */}
      <div 
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(212,175,55,0.07)_0%,transparent_60%)] z-0" 
        aria-hidden="true" 
      />

      <div className="relative z-10 w-full max-w-[420px] sm:max-w-[440px] flex flex-col items-center">
        {/* Centered Royal Enterprises Logo Branding */}
        <header className="w-full max-w-[210px] sm:max-w-[250px] mb-5 sm:mb-7 flex flex-col items-center text-center">
          <BrandLogo 
            variant="clean" 
            className="w-full h-auto max-h-16 sm:max-h-20 object-contain drop-shadow-[0_4px_16px_rgba(212,175,55,0.22)]" 
          />
        </header>

        {/* Password Recovery Card */}
        <section 
          className="w-full rounded-2xl bg-[#0c141d]/95 border border-[#d4af37]/35 shadow-[0_16px_45px_rgba(0,0,0,0.7),0_0_25px_rgba(212,175,55,0.06)] backdrop-blur-md p-6 sm:p-8 space-y-6"
          aria-labelledby="recovery-title"
        >
          {/* Lock / Key Icon Badge */}
          <div className="flex justify-center">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-[#1c170d] border border-[#d4af37]/45 flex items-center justify-center shadow-[0_0_18px_rgba(212,175,55,0.18)]">
              {collecting ? (
                <KeyRound className="w-6 h-6 sm:w-7 sm:h-7 text-[#e5a83b]" aria-hidden="true" />
              ) : (
                <Lock className="w-6 h-6 sm:w-7 sm:h-7 text-[#e5a83b]" aria-hidden="true" />
              )}
            </div>
          </div>

          {/* Title & Description */}
          <div className="text-center space-y-2">
            <h1 id="recovery-title" className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {collecting ? (setup ? 'Set Up Your Password' : 'Set a New Password') : 'Forgot Your Password?'}
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed max-w-[340px] mx-auto">
              {collecting ? (
                setup
                  ? 'Set a strong password for your verified account. Save it securely before signing in.'
                  : 'Choose a new account password or generate a strong password below. Save it securely before signing in.'
              ) : (
                <>
                  Enter your registered account email. We'll send a one-time code (OTP) valid for 10 minutes.
                  <span className="sr-only">one-time code valid for 10 minutes</span>
                </>
              )}
            </p>
          </div>

          {success ? (
            <div role="status" className="rounded-xl bg-emerald-950/40 border border-emerald-500/30 p-4 text-xs sm:text-sm text-emerald-300 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{success}</span>
            </div>
          ) : reset && !validToken ? (
            <div role="alert" className="rounded-xl bg-red-950/40 border border-red-500/30 p-4 text-xs sm:text-sm text-red-300 space-y-2">
              <p>This reset link is missing or invalid.</p>
              <Link className="inline-block text-[#e5a83b] hover:text-[#f3be58] underline font-medium" to="/employee/forgot-password">
                Request a new link
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {collecting ? (
                <>
                  {/* Step 2: OTP Verification & Password Reset */}
                  {!reset && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs sm:text-sm font-medium text-gray-300" htmlFor="recovery-code">
                          Email OTP
                        </label>
                        <span className="text-[11px] text-[#e5a83b]/80 font-medium">Valid for 10 min</span>
                      </div>
                      <div className="relative flex items-center">
                        <div className="absolute left-3.5 pointer-events-none text-gray-400">
                          <KeyRound className="w-4 h-4 text-gray-400" aria-hidden="true" />
                        </div>
                        <input
                          id="recovery-code"
                          className="w-full pl-10 pr-4 py-2.5 sm:py-3 rounded-xl bg-[#080f16] border border-gray-700/60 text-white placeholder-gray-500 font-mono tracking-widest text-center text-base sm:text-lg focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition-all duration-200"
                          autoComplete="one-time-code"
                          inputMode="numeric"
                          pattern="[0-9]{6}"
                          maxLength={6}
                          required
                          placeholder="123456"
                          value={code}
                          onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                          disabled={busy}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-400 pt-0.5">
                        <button
                          type="button"
                          onClick={() => { setChallenge(''); setCode(''); setError(''); }}
                          className="text-gray-400 hover:text-gray-200 underline focus:outline-none"
                        >
                          Change email
                        </button>
                        {cooldown > 0 ? (
                          <span className="text-gray-500">Resend OTP in {cooldown}s</span>
                        ) : (
                          <button
                            type="button"
                            disabled={busy || inFlight.current}
                            onClick={handleResendOtp}
                            className="text-[#e5a83b] hover:text-[#f3be58] underline focus:outline-none disabled:opacity-50"
                          >
                            Resend OTP
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* New Password */}
                  <div className="space-y-1.5">
                    <label className="block text-xs sm:text-sm font-medium text-gray-300" htmlFor="new-password">
                      New password
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3.5 pointer-events-none text-gray-400">
                        <Lock className="w-4 h-4 text-gray-400" aria-hidden="true" />
                      </div>
                      <input
                        id="new-password"
                        className="w-full pl-10 pr-10 py-2.5 sm:py-3 rounded-xl bg-[#080f16] border border-gray-700/60 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition-all duration-200"
                        type={show ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        minLength={12}
                        maxLength={64}
                        pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{12,64}"
                        placeholder="Enter new password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        disabled={busy}
                        aria-describedby="password-rules"
                      />
                      <button
                        type="button"
                        onClick={() => setShow(!show)}
                        className="absolute right-3.5 text-gray-400 hover:text-gray-200 focus:outline-none p-1"
                        aria-label={show ? 'Hide password' : 'Show password'}
                      >
                        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p id="password-rules" className="text-[11px] text-gray-400 leading-tight">
                      12–64 characters, including uppercase, lowercase, a number and a symbol.
                    </p>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <label className="block text-xs sm:text-sm font-medium text-gray-300" htmlFor="confirm-password">
                      Confirm new password
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3.5 pointer-events-none text-gray-400">
                        <Lock className="w-4 h-4 text-gray-400" aria-hidden="true" />
                      </div>
                      <input
                        id="confirm-password"
                        className="w-full pl-10 pr-10 py-2.5 sm:py-3 rounded-xl bg-[#080f16] border border-gray-700/60 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition-all duration-200"
                        type={show ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        minLength={12}
                        maxLength={64}
                        placeholder="Confirm new password"
                        value={confirmation}
                        onChange={e => setConfirmation(e.target.value)}
                        disabled={busy}
                      />
                      <button
                        type="button"
                        onClick={() => setShow(!show)}
                        className="absolute right-3.5 text-gray-400 hover:text-gray-200 focus:outline-none p-1"
                        aria-label={show ? 'Hide password' : 'Show password'}
                      >
                        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Options: Show passwords & Generate */}
                  <div className="flex items-center justify-between text-xs sm:text-sm pt-0.5">
                    <label className="flex min-h-8 items-center gap-2 text-gray-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={show}
                        onChange={e => setShow(e.target.checked)}
                        className="rounded border-gray-700 bg-[#080f16] text-[#d4af37] focus:ring-[#d4af37] accent-[#d4af37]"
                      />
                      <span>Show passwords</span>
                    </label>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={generate}
                      className="text-xs font-medium text-[#e5a83b] hover:text-[#f3be58] hover:underline focus:outline-none flex items-center gap-1.5 py-1 px-2 rounded-lg bg-[#d4af37]/10 border border-[#d4af37]/20 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate strong password</span>
                    </button>
                  </div>
                </>
              ) : (
                /* Step 1: Registered Email Address */
                <div className="space-y-1.5">
                  <label className="block text-xs sm:text-sm font-medium text-gray-300" htmlFor="recovery-email">
                    Registered email address
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 pointer-events-none text-gray-400">
                      <Mail className="w-4 h-4 text-gray-400" aria-hidden="true" />
                    </div>
                    <input
                      id="recovery-email"
                      className="w-full pl-10 pr-4 py-2.5 sm:py-3 rounded-xl bg-[#080f16] border border-gray-700/60 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition-all duration-200 shadow-inner"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      maxLength={254}
                      required
                      placeholder="Enter your email address"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      disabled={busy}
                    />
                  </div>
                </div>
              )}

              {/* Error Message Alert */}
              {error && (
                <div role="alert" className="rounded-xl bg-red-950/40 border border-red-500/30 p-3.5 text-xs sm:text-sm text-red-300 flex items-start gap-2.5 animate-in">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={busy}
                className="w-full h-11 sm:h-12 rounded-xl bg-gradient-to-r from-[#e5a83b] via-[#f0bb4e] to-[#d89728] hover:from-[#f0bb4e] hover:to-[#e5a83b] text-[#161005] font-semibold text-sm sm:text-base flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(212,175,55,0.25)] hover:shadow-[0_6px_20px_rgba(212,175,55,0.35)] active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
              >
                {busy ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-[#161005]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{collecting ? (setup ? 'Setting password…' : 'Resetting password…') : 'Sending verification code…'}</span>
                  </>
                ) : collecting ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                    <span>{setup ? 'Set Password' : 'Save new password'}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" aria-hidden="true" />
                    <span>Send OTP</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Thin Gold Divider */}
          <div className="relative my-4 flex items-center justify-center">
            <div className="w-full border-t border-gray-800/80" />
          </div>

          {/* Back to Login Link */}
          <div className="text-center">
            <Link
              to={`/${role.toLowerCase()}/login`}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[#e5a83b] hover:text-[#f3be58] transition-colors focus:outline-none focus:underline"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Back to Login</span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
