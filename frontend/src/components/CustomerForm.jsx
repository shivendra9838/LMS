import {LoadingButton} from "./ui/Loading";
import AdminCustomerFields from './customers/AdminCustomerFields';
import { useNavigate } from 'react-router-dom';

const CustomerForm = ({ formData, handleChange, handleSubmit, loading, isEdit, basePath, submitLabel, showEmployeeSelect, employees, onEmployeeChange, showEmployeeNotes, premium=false, errors={} }) => {
  const navigate = useNavigate();

  if(premium)return <AdminCustomerFields {...{formData,handleChange,handleSubmit,loading,employees,errors}} cancel={()=>navigate(basePath)}/>;
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
          <label htmlFor="field-full-name" className="text-sm font-medium text-gray-700">Full Name *</label>
          <input id="field-full-name" type="text" name="name" required value={formData.name} onChange={handleChange} className="input-field" placeholder="Ramesh Kumar" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="field-father-s-name" className="text-sm font-medium text-gray-700">Father's Name *</label>
          <input id="field-father-s-name" type="text" name="fatherName" required value={formData.fatherName} onChange={handleChange} className="input-field" placeholder="Shyam Kumar" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="field-age" className="text-sm font-medium text-gray-700">Age *</label>
          <input id="field-age" type="number" inputMode="numeric" name="age" required min="19" value={formData.age} onChange={handleChange} className="input-field" placeholder="32" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="field-gender" className="text-sm font-medium text-gray-700">Gender</label>
          <select id="field-gender" name="gender" value={formData.gender} onChange={handleChange} className="input-field">
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="field-occupation" className="text-sm font-medium text-gray-700">Occupation *</label>
          <input id="field-occupation" type="text" name="occupation" required value={formData.occupation} onChange={handleChange} className="input-field" placeholder="Shop Owner" />
        </div>

        {showEmployeeSelect && (
          <div className="col-span-full pt-4 pb-2 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800">Allocate to Employee</h2>
          </div>
        )}
        {showEmployeeSelect && (
          <div className="col-span-full space-y-1.5">
            <label htmlFor="field-assigned-employee" className="text-sm font-medium text-gray-700">Assigned Employee *</label>
            <select id="field-assigned-employee"
              name="employeeId"
              required
              value={formData.employeeId || ''}
              onChange={onEmployeeChange || handleChange}
              className="input-field"
            >
              <option value="">Select employee</option>
              {employees?.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.name} ({emp.employeeCode}) — {emp.area}
                </option>
              ))}
            </select>
          </div>
        )}

        {showEmployeeNotes && (
          <div className="col-span-full space-y-1.5">
            <label htmlFor="field-note-for-admin-optional" className="text-sm font-medium text-gray-700">Note for Admin (optional)</label>
            <textarea id="field-note-for-admin-optional"
              name="employeeNotes"
              rows={3}
              value={formData.employeeNotes || ''}
              onChange={handleChange}
              className="input-field"
              placeholder="Any details admin should know about this customer..."
            />
          </div>
        )}

        {/* Contact Details */}
        <div className="col-span-full pt-4 pb-2 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Contact & Address</h2>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="field-mobile-number" className="text-sm font-medium text-gray-700">Mobile Number *</label>
          <input id="field-mobile-number" type="tel" inputMode="tel" name="mobile" required value={formData.mobile} onChange={handleChange} className="input-field" placeholder="9876543210" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="field-alternate-mobile" className="text-sm font-medium text-gray-700">Alternate Mobile</label>
          <input id="field-alternate-mobile" type="tel" inputMode="tel" name="alternateMobile" value={formData.alternateMobile} onChange={handleChange} className="input-field" placeholder="Optional" />
        </div>
        <div className="col-span-full space-y-1.5">
          <label htmlFor="field-full-address" className="text-sm font-medium text-gray-700">Full Address *</label>
          <input id="field-full-address" type="text" name="address" required value={formData.address} onChange={handleChange} className="input-field" placeholder="House No, Street, Sector" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="field-city" className="text-sm font-medium text-gray-700">City *</label>
          <input id="field-city" type="text" name="city" required value={formData.city} onChange={handleChange} className="input-field" placeholder="Mumbai" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="field-area" className="text-sm font-medium text-gray-700">Area *</label>
          <input id="field-area" type="text" name="area" required value={formData.area} onChange={handleChange} className="input-field" placeholder="Vashi" />
        </div>
        <div className="col-span-full space-y-1.5">
          <label htmlFor="field-landmark" className="text-sm font-medium text-gray-700">Landmark</label>
          <input id="field-landmark" type="text" name="landmark" value={formData.landmark} onChange={handleChange} className="input-field" placeholder="Near Hospital" />
        </div>

        {/* ID Proof */}
        <div className="col-span-full pt-4 pb-2 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Identity Proof</h2>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="field-id-proof-type" className="text-sm font-medium text-gray-700">ID Proof Type</label>
          <select id="field-id-proof-type" name="idProofType" value={formData.idProofType} onChange={handleChange} className="input-field">
            <option value="Aadhar">Aadhar</option>
            <option value="PAN">PAN</option>
            <option value="VoterID">Voter ID</option>
            <option value="DrivingLicense">Driving License</option>
            <option value="Passport">Passport</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="field-id-proof-number" className="text-sm font-medium text-gray-700">ID Proof Number</label>
          <input id="field-id-proof-number" type="text" name="idProofNumber" value={formData.idProofNumber} onChange={handleChange} className="input-field" placeholder="ID Number" />
        </div>
      </div>
      
      <div className="pt-4 flex flex-wrap justify-end gap-3 border-t border-gray-100 mt-6">
        <button type="button" onClick={() => navigate(basePath)} className="btn-secondary">
          Cancel
        </button>
        <LoadingButton busy={loading} loadingText={"Saving..."} type="submit" disabled={loading} className="btn-primary min-w-[120px]">
          {loading ? 'Saving...' : (submitLabel || (isEdit ? 'Save Changes' : 'Add Customer'))}
        </LoadingButton>
      </div>
    </form>
  );
};

export default CustomerForm;
