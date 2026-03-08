import { ExternalLink, CheckCircle2, IndianRupee, Star, Tag, ChevronRight } from 'lucide-react';

function SchemeCard({ scheme }) {
  const matchPercent = scheme.relevanceScore ? Math.round((scheme.relevanceScore / 15) * 100) : null;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-gray-900 leading-tight">{scheme.name}</h3>
          {scheme.nameHindi && (
            <p className="text-sm text-gray-500 mt-0.5">{scheme.nameHindi}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {matchPercent !== null && (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
              matchPercent >= 70 ? 'bg-emerald-50 text-emerald-700' : matchPercent >= 40 ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-600'
            }`}>
              <Star className="w-3 h-3" />
              {matchPercent}%
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full">
            <Tag className="w-3 h-3" />
            {scheme.category}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">{scheme.description}</p>

      {/* Benefits */}
      {scheme.benefits && scheme.benefits.length > 0 && (
        <div className="mt-4 space-y-2">
          {scheme.benefits.map((benefit, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-gray-700">{benefit}</span>
            </div>
          ))}
        </div>
      )}

      {/* Amount & Apply */}
      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
        {scheme.benefitAmount > 0 ? (
          <div className="flex items-baseline gap-1">
            <IndianRupee className="w-5 h-5 text-orange-500" />
            <span className="text-2xl font-bold text-gray-900">
              {scheme.benefitAmount.toLocaleString('en-IN')}
            </span>
            <span className="text-sm text-gray-500 ml-1">/year</span>
          </div>
        ) : (
          <div />
        )}
        <a
          href={scheme.officialWebsite}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold rounded-xl hover:shadow-md hover:shadow-orange-200/50 transition-all group-hover:gap-2"
        >
          Apply Now
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}

export default SchemeCard;
