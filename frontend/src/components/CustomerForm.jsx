import { useNavigate } from 'react-router-dom';

const CustomerForm = ({ formData, handleChange, handleSubmit, loading, isEdit, basePath }) => {
  const navigate = useNavigate();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        {/* Personal Details */}
        <div className="col-span-full pb-2 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Personal Details</h2>
          {isEdit && formData.customerCode && (
            <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
              Code: {formData.customerCode}
            </span>
          )}
        </div>
        
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Full Name *</label>
          <input type="text" name="name" required value={formData.name} onChange={handleChange} className="input-field" placeholder="Ramesh Kumar" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Father's Name *</label>
          <input type="text" name="fatherName" required value={formData.fatherName} onChange={handleChange} className="input-field" placeholder="Shyam Kumar" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Age *</label>
          <input type="number" name="age" required min="19" value={formData.age} onChange={handleChange} className="input-field" placeholder="32" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Gender</label>
          <select name="gender" value={formData.gender} onChange={handleChange} className="input-field">
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Occupation *</label>
          <input type="text" name="occupation" required value={formData.occupation} onChange={handleChange} className="input-field" placeholder="Shop Owner" />
        </div>

        {/* Contact Details */}
        <div className="col-span-full pt-4 pb-2 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Contact & Address</h2>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Mobile Number *</label>
          <input type="tel" name="mobile" required value={formData.mobile} onChange={handleChange} className="input-field" placeholder="9876543210" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Alternate Mobile</label>
          <input type="tel" name="alternateMobile" value={formData.alternateMobile} onChange={handleChange} className="input-field" placeholder="Optional" />
        </div>
        <div className="col-span-full space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Full Address *</label>
          <input type="text" name="address" required value={formData.address} onChange={handleChange} className="input-field" placeholder="House No, Street, Sector" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">City *</label>
          <input type="text" name="city" required value={formData.city} onChange={handleChange} className="input-field" placeholder="Mumbai" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Area *</label>
          <input type="text" name="area" required value={formData.area} onChange={handleChange} className="input-field" placeholder="Vashi" />
        </div>
        <div className="col-span-full space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Landmark</label>
          <input type="text" name="landmark" value={formData.landmark} onChange={handleChange} className="input-field" placeholder="Near Hospital" />
        </div>

        {/* ID Proof */}
        <div className="col-span-full pt-4 pb-2 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Identity Proof</h2>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">ID Proof Type</label>
          <select name="idProofType" value={formData.idProofType} onChange={handleChange} className="input-field">
            <option value="Aadhar">Aadhar</option>
            <option value="PAN">PAN</option>
            <option value="VoterID">Voter ID</option>
            <option value="DrivingLicense">Driving License</option>
            <option value="Passport">Passport</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">ID Proof Number</label>
          <input type="text" name="idProofNumber" value={formData.idProofNumber} onChange={handleChange} className="input-field" placeholder="ID Number" />
        </div>
      </div>
      
      <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
        <button type="button" onClick={() => navigate(basePath)} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={loading} className="btn-primary min-w-[120px]">
          {loading ? 'Saving...' : (isEdit ? 'Save Changes' : 'Add Customer')}
        </button>
      </div>
    </form>
  );
};

export default CustomerForm;
