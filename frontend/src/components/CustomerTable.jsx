import LoadingIndicator from './ui/Loading';
import {CustomerIdentity} from './CustomerPhoto';
import {customerRowProps} from '../utils/customerPhoto';
import CustomerRisk,{RiskGroup} from './CustomerRisk';
import { Edit2, ShieldAlert, ShieldCheck, Eye } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import StatusBadge from './StatusBadge';

const CustomerTable = ({ customers, loading, refresh, basePath = '/admin/customers' }) => {
  const navigate = useNavigate();

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.patch(`/customers/${id}/status`, { status: newStatus });
      toast.success(`Customer marked as ${newStatus}`);
      refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update status');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingIndicator message="Loading customers…" variant="section"/>
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <p className="text-lg">No customers found.</p>
      </div>
    );
  }

  return (
    <RiskGroup ids={customers.map(c=>c._id)}>
    <div className="md:hidden divide-y divide-gray-100">
      {customers.map(customer => <article key={customer._id} {...customerRowProps(customer,basePath,navigate)} className="customer-click-row p-4 space-y-3">
        <div className="flex flex-wrap justify-between items-start gap-2"><CustomerIdentity customer={customer} basePath={basePath}/><StatusBadge status={customer.status} /></div>
        <CustomerRisk customerId={customer._id}/><dl className="text-sm grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2"><dt className="text-gray-500">Mobile</dt><dd><a className="text-blue-700 inline-flex items-center" href={`tel:${customer.mobile}`}>{customer.mobile}</a></dd><dt className="text-gray-500">Location</dt><dd>{customer.city} · {customer.area}</dd></dl>
        <div className="grid grid-cols-2 gap-2"><button className="btn-primary text-sm" onClick={() => navigate(`${basePath}/${customer._id}`)}>View Details</button><button className="btn-secondary text-sm" onClick={() => navigate(`${basePath}/${customer._id}/${customer.kycLeadId ? 'kyc' : 'edit'}`)}>{customer.kycLeadId ? 'View / Revise KYC' : 'Edit Customer'}</button></div>
        <button className="text-sm text-gray-600 underline w-full" onClick={() => toggleStatus(customer._id, customer.status)}>{customer.status === 'ACTIVE' ? 'Deactivate Customer' : 'Activate Customer'}</button>
      </article>)}
    </div>
    <table className="hidden md:table w-full text-left text-sm text-gray-600">
      <thead className="bg-gray-50/50 text-gray-700 text-xs uppercase tracking-wider border-b border-gray-100">
        <tr>
          <th className="px-6 py-4 font-medium">Code</th>
          <th className="px-6 py-4 font-medium">Name</th>
          <th className="px-6 py-4 font-medium">Contact</th>
          <th className="px-6 py-4 font-medium">Location</th>
          <th className="px-6 py-4 font-medium">Status</th>
          <th className="px-6 py-4 font-medium text-right">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {customers.map((cus) => (
          <tr key={cus._id} {...customerRowProps(cus,basePath,navigate)}>
            <td className="px-6 py-4 font-medium text-gray-900"><Link to={`${basePath}/${cus._id}`}>{cus.customerCode}</Link></td>
            <td className="px-6 py-4">
              <CustomerIdentity customer={cus} basePath={basePath} showCode={false}/><CustomerRisk customerId={cus._id}/>
            </td>
            <td className="px-6 py-4">
              <div className="font-medium text-gray-900">{cus.mobile}</div>
            </td>
            <td className="px-6 py-4">
              <div>{cus.city}</div>
              <div className="text-xs text-gray-500">{cus.area}</div>
            </td>
            <td className="px-6 py-4">
              <StatusBadge status={cus.status} />
            </td>
            <td className="px-6 py-4 text-right">
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => navigate(`${basePath}/${cus._id}`)}
                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  title="View Details"
                >
                  <Eye size={16} />
                </button>
                <button
                  onClick={() => toggleStatus(cus._id, cus.status)}
                  className={`p-2 rounded-lg transition-colors ${
                    cus.status === 'ACTIVE' 
                      ? 'text-red-600 hover:bg-red-50' 
                      : 'text-emerald-600 hover:bg-emerald-50'
                  }`}
                  title={cus.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                >
                  {cus.status === 'ACTIVE' ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
                </button>
                <button
                  onClick={() => navigate(`${basePath}/${cus._id}/${cus.kycLeadId ? 'kyc' : 'edit'}`)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title={cus.kycLeadId ? 'View / Revise KYC' : 'Edit'}
                >
                  <Edit2 size={16} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </RiskGroup>
  );
};

export default CustomerTable;
