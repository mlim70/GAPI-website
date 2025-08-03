interface PlaceholderImageProps {
  width?: number;
  height?: number;
  text?: string;
  className?: string;
}

export default function PlaceholderImage({ 
  width, 
  height, 
  text = "Event Image", 
  className = "" 
}: PlaceholderImageProps) {
  const style = width && height ? { width: `${width}px`, height: `${height}px` } : {};
  
  return (
    <div 
      className={`bg-gradient-to-br from-red to-neutral-dark flex items-center justify-center text-white font-semibold text-lg ${className}`}
      style={style}
    >
      <div className="text-center">
        <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p>{text}</p>
      </div>
    </div>
  );
} 
