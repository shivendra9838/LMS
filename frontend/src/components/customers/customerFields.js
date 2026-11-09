export const customerSections=[
 {title:'Personal Details',icon:'personal',fields:[['name','Full Name','text',true],['fatherName',"Father’s Name",'text',true],['age','Age','number',true],['gender','Gender','gender'],['occupation','Occupation','text',true]]},
 {title:'Contact & Address',icon:'address',fields:[['mobile','Mobile Number','tel',true],['alternateMobile','Alternate Mobile','tel'],['address','Full Address','text',true],['city','City','text',true],['area','Area','text',true],['landmark','Landmark','text']]},
 {title:'Allocate to Employee',icon:'employee',fields:[['employeeId','Assigned Employee','employee',true]]},
 {title:'Identity Proof',icon:'identity',fields:[['idProofType','ID Proof Type','identity'],['idProofNumber','ID Proof Number','text']]}
];
export function validateCustomerFields(value){const errors={};for(const section of customerSections)for(const [key,label,,required]of section.fields)if(required&&!String(value[key]??'').trim())errors[key]=label+' is required';if(value.name?.trim()&&value.name.trim().length<2)errors.name='Name must be at least 2 characters';if(value.mobile&&!/^[0-9]{10}$/.test(value.mobile))errors.mobile='Enter a 10-digit mobile number';if(value.age&&(!Number.isInteger(Number(value.age))||Number(value.age)<19))errors.age='Age must be greater than 18';return errors;}
