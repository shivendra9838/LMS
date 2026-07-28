import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import CustomerCard from '../../components/CustomerCard';

const CustomerDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cusRes, timeRes] = await Promise.all([
          api.get(`/customers/${id}`),
          api.get(`/customers/${id}/timeline`)
        ]);
        setCustomer(cusRes.data.data);
        setTimeline(timeRes.data.data);
      } catch (error) {
        toast.error('Failed to load customer details');
        navigate('/employee/customers');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!customer) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CustomerCard 
            customer={customer} 
            onEdit={() => navigate(`/employee/customers/${customer._id}/edit`)} 
          />
        </div>

        {/* Timeline Column */}
        <div className="glass-panel p-6 h-fit">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3 mb-4">
            <Clock className="text-blue-500" size={20} />
            <h2 className="text-lg font-semibold text-gray-800">Timeline</h2>
          </div>
          
          <div className="relative border-l border-gray-200 ml-3 space-y-6">
            {timeline.length === 0 ? (
              <p className="text-sm text-gray-500 pl-4">No events found.</p>
            ) : (
              timeline.map((event) => (
                <div key={event._id} className="relative pl-6">
                  {/* Timeline dot */}
                  <div className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-white"></div>
                  
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-900">{event.action}</span>
                    <span className="text-sm text-gray-600 mt-0.5">{event.details}</span>
                    <span className="text-xs text-gray-400 mt-1">
                      {new Date(event.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDetails;
