import { Metadata } from 'next';
import { Building, MapPin, Phone, Mail, FileText, Shield, Award } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Business Information - TecBunny Store',
  description: 'Official business registration details, company information, and legal documentation for TECBUNNY SOLUTIONS PRIVATE LIMITED.',
  keywords: ['business', 'registration', 'company', 'legal', 'GST', 'CIN', 'PAN', 'TecBunny'],
  openGraph: {
    title: 'Business Information - TecBunny Store',
    description: 'Official business registration details and company information for TECBUNNY SOLUTIONS PRIVATE LIMITED.',
    type: 'website',
  },
};

// export const dynamic = 'force-static';

export default function BusinessInfoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Business Information
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Official registration details and business documentation for TECBUNNY SOLUTIONS PRIVATE LIMITED
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Company Overview */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-6 w-6 text-blue-600" />
              Company Overview
            </CardTitle>
            <CardDescription>
              Legal entity information and business registration details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Legal Name</h3>
                <p className="text-gray-700">TECBUNNY SOLUTIONS PRIVATE LIMITED</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Trade Name</h3>
                <p className="text-gray-700">TecBunny Store</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Business Type</h3>
                <p className="text-gray-700">Private Limited Company</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Incorporation Date</h3>
                <p className="text-gray-700">2025</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Registration Details */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-green-600" />
              Official Registration Details
            </CardTitle>
            <CardDescription>
              Government issued registration numbers and certifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="text-lg font-semibold text-green-800 mb-2">Corporate Identity Number (CIN)</h3>
                <p className="text-green-700 font-mono text-lg mb-3">U80200GA2025PTC017488</p>
                <a 
                  href="/documents/COI.pdf" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-green-700 hover:text-green-800 font-medium"
                >
                  <FileText className="h-4 w-4" />
                  Download Certificate of Incorporation
                </a>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="text-lg font-semibold text-blue-800 mb-2">GST Identification Number (GSTIN)</h3>
                <p className="text-blue-700 font-mono text-lg mb-3">30AAMCT1608G1ZO</p>
                <a 
                  href="/documents/GSTIN.pdf" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-blue-700 hover:text-blue-800 font-medium"
                >
                  <FileText className="h-4 w-4" />
                  Download GST Certificate
                </a>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h3 className="text-lg font-semibold text-purple-800 mb-2">Permanent Account Number (PAN)</h3>
                <p className="text-purple-700 font-mono text-lg">AAMCT1608G</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <h3 className="text-lg font-semibold text-orange-800 mb-2">Tax Deduction Number (TAN)</h3>
                <p className="text-orange-700 font-mono text-lg">BLRT25863F</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Registered Address */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-6 w-6 text-red-600" />
              Registered Address
            </CardTitle>
            <CardDescription>
              Official business address as per government records
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
              <address className="text-lg text-gray-700 not-italic leading-relaxed">
                TECBUNNY SOLUTIONS PRIVATE LIMITED<br />
                H NO 11 NHAYGINWADA, PARSE<br />
                Parxem, Pernem<br />
                North Goa - 403512<br />
                Goa, India
              </address>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-6 w-6 text-blue-600" />
              Official Contact Information
            </CardTitle>
            <CardDescription>
              Verified contact details for business communication
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-green-600" />
              <div>
                <h3 className="font-semibold text-gray-900">Customer Support</h3>
                <p className="text-gray-700">+91 96041 36010</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="font-semibold text-gray-900">Business Email</h3>
                <p className="text-gray-700">support@tecbunny.com</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Building className="h-5 w-5 text-purple-600" />
              <div>
                <h3 className="font-semibold text-gray-900">Website</h3>
                <p className="text-gray-700">https://www.tecbunny.com</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business Activities */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-6 w-6 text-yellow-600" />
              Business Activities
            </CardTitle>
            <CardDescription>
              Primary business activities and services offered
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Primary Activities</h3>
                <ul className="list-disc list-inside space-y-2 text-gray-700">
                  <li>Retail and wholesale of electronic goods and accessories</li>
                  <li>CCTV surveillance systems and security solutions</li>
                  <li>Computer peripherals and networking equipment</li>
                  <li>Mobile accessories and gadgets</li>
                  <li>Installation and technical support services</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Service Areas</h3>
                <p className="text-gray-700">
                  We serve customers across India with online sales and delivery services. 
                  Our primary service areas include Goa, Maharashtra, Karnataka, and other major states.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Official Documents */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-blue-600" />
              Official Business Documents
            </CardTitle>
            <CardDescription>
              Download authentic business registration documents for verification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center justify-between p-6 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <FileText className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Certificate of Incorporation</h3>
                    <p className="text-sm text-gray-600">Official company registration document</p>
                  </div>
                </div>
                <a 
                  href="/documents/COI.pdf" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  <FileText className="h-4 w-4" />
                  View PDF
                </a>
              </div>
              
              <div className="flex items-center justify-between p-6 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Shield className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">GST Registration Certificate</h3>
                    <p className="text-sm text-gray-600">Goods and Services Tax registration</p>
                  </div>
                </div>
                <a 
                  href="/documents/GSTIN.pdf" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  <Shield className="h-4 w-4" />
                  View PDF
                </a>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-800 mb-1">Document Authenticity</h3>
                  <p className="text-sm text-blue-700">
                    These are official documents issued by the Government of India. All information is verifiable 
                    through respective government portals. Documents are provided for transparency and business verification purposes.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Compliance & Certifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-green-600" />
              Compliance & Certifications
            </CardTitle>
            <CardDescription>
              Legal compliance and business certifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Shield className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-green-800">GST Registered</h3>
                  <p className="text-green-700 text-sm">Valid GST registration for tax compliance</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-800">MCA Compliant</h3>
                  <p className="text-blue-700 text-sm">Registered with Ministry of Corporate Affairs</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <Award className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-purple-800">Tax Compliant</h3>
                  <p className="text-purple-700 text-sm">Regular tax filings and compliance</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-lg">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <Building className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-orange-800">Authorized Retailer</h3>
                  <p className="text-orange-700 text-sm">Authorized to sell electronic goods</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500">
            This information is accurate as of October 2025. For any business inquiries or verification, 
            please contact us at support@tecbunny.com or +91 96041 36010.
          </p>
        </div>
      </div>
    </div>
  );
}
