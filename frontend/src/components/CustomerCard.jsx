import { User, Phone, MapPin, Briefcase, FileText } from 'lucide-react';
import StatusBadge from './StatusBadge';

const CustomerCard = ({ customer, onEdit }) => {
  if (!customer) return null;

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-2xl font-bold">
            {customer.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
            <p className="text-gray-500 font-medium">{customer.customerCode}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={customer.status} />
          {onEdit && (
            <button onClick={onEdit} className="btn-secondary">
              Edit Profile
            </button>
          )}
        </div>
      </div>

      <div className="glass-panel p-6">
        <h2 className="text-lg font-semibold text-gray-800 border-b border-gray-100 pb-3 mb-4">Personal Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
          <div className="flex items-start gap-3">
            <User className="text-gray-400 mt-0.5" size={18} />
            <div>
              <p className="text-xs text-gray-500 font-medium">Father's Name</p>
              <p className="text-gray-900 font-medium">{customer.fatherName}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <User className="text-gray-400 mt-0.5" size={18} />
            <div>
              <p className="text-xs text-gray-500 font-medium">Age & Gender</p>
              <p className="text-gray-900 font-medium">{customer.age} years, {customer.gender}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Briefcase className="text-gray-400 mt-0.5" size={18} />
            <div>
              <p className="text-xs text-gray-500 font-medium">Occupation</p>
              <p className="text-gray-900 font-medium">{customer.occupation}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6">
        <h2 className="text-lg font-semibold text-gray-800 border-b border-gray-100 pb-3 mb-4">Contact & Address</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
          <div className="flex items-start gap-3">
            <Phone className="text-gray-400 mt-0.5" size={18} />
            <div>
              <p className="text-xs text-gray-500 font-medium">Mobile</p>
              <p className="text-gray-900 font-medium">{customer.mobile}</p>
              {customer.alternateMobile && <p className="text-xs text-gray-500 mt-0.5">Alt: {customer.alternateMobile}</p>}
            </div>
          </div>
          <div className="flex items-start gap-3 sm:col-span-2">
            <MapPin className="text-gray-400 mt-0.5" size={18} />
            <div>
              <p className="text-xs text-gray-500 font-medium">Full Address</p>
              <p className="text-gray-900 font-medium">{customer.address}</p>
              <p className="text-gray-500 text-sm">{customer.area}, {customer.city}</p>
              {customer.landmark && <p className="text-gray-500 text-sm">Landmark: {customer.landmark}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6">
        <h2 className="text-lg font-semibold text-gray-800 border-b border-gray-100 pb-3 mb-4">Identity Proof</h2>
        <div className="flex items-start gap-3">
          <FileText className="text-gray-400 mt-0.5" size={18} />
          <div>
            <p className="text-xs text-gray-500 font-medium">{customer.idProofType}</p>
            <p className="text-gray-900 font-medium">{customer.idProofNumber || 'Not provided'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerCard;
