export default function SearchBar({ value, onChange }) {
  return (
    <input
      type="text"
      placeholder="Search parking by name or area..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="
        w-full
        bg-black/40
        border border-white/10
        rounded-xl
        px-4 py-3
        text-white
        placeholder-gray-500
        focus:outline-none
        focus:ring-2 focus:ring-white/20
      "
    />
  );
}
