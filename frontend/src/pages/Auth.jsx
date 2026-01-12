import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState("USER");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match");
        }

        await register({
          name,
          phone,
          email,
          password,
          role,
        });
        setIsLogin(true);
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-[#0b0b0f] via-[#111827] to-black flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="ui-card w-full max-w-md p-6 sm:p-8 shadow-xl"
      >
        <h2 className="text-3xl font-bold text-center mb-6">
          {isLogin ? "Login" : "Register"}
        </h2>

        {!isLogin && (
          <>
            <input
              type="text"
              placeholder="Full name"
              className="ui-input mb-4"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <input
              type="tel"
              placeholder="Phone number"
              className="ui-input mb-4"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </>
        )}

        <input
          type="email"
          placeholder="Email"
          className="ui-input mb-4"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="ui-input mb-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {!isLogin && (
          <input
            type="password"
            placeholder="Confirm password"
            className="ui-input mb-4"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        )}

        {!isLogin && (
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="ui-select mb-4"
          >
            <option value="USER">User</option>
            <option value="OWNER">Owner</option>
          </select>
        )}

        {error && (
          <p className="mb-4 text-sm text-red-300">{error}</p>
        )}

        <button className="ui-btn-primary w-full">
          {loading
            ? isLogin
              ? "Logging in…"
              : "Registering…"
            : isLogin
              ? "Login"
              : "Register"}
        </button>

        <p
          className="mt-5 text-center text-sm text-zinc-600"
          onClick={() => {
            setError(null);
            setIsLogin(!isLogin);
          }}
        >
          <span className="cursor-pointer ui-link">
            {isLogin ? "Create an account" : "Already have an account?"}
          </span>
        </p>
      </form>
    </div>
  );
}
