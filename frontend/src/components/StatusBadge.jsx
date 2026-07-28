const StatusBadge = ({ status }) => {
  const isInactive = status === 'INACTIVE';
  return (
    <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${
      isInactive 
        ? 'bg-gray-100 text-gray-600 border-gray-200' 
        : 'bg-emerald-50 text-emerald-600 border-emerald-200'
    }`}>
      {status}
    </span>
  );
};

export default StatusBadge;
