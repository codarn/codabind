interface LogoProps {
  size?: number;
}

export function Logo({ size = 28 }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M14 4H50Q60 4 60 14V26Q60 30 54 32Q60 34 60 38V50Q60 60 50 60H14Q4 60 4 50V38Q4 34 10 32Q4 30 4 26V14Q4 4 14 4Z"
        fill="#0d4d28"
      />
      <path
        d="M16 8H48Q56 8 56 16V26Q56 30 51 32Q56 34 56 38V48Q56 56 48 56H16Q8 56 8 48V38Q8 34 13 32Q8 30 8 26V16Q8 8 16 8Z"
        fill="#c8f5d4"
      />
      <path
        d="M21 33L29 41L44 23"
        stroke="#39ff14"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
