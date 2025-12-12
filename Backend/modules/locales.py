LOCALES = {
    "us": {"country": "us", "gl": "US", "hl": "en-US", "ceid": "US:en"},
    "in": {"country": "in", "gl": "IN", "hl": "en-IN", "ceid": "IN:en"},
    "gb": {"country": "gb", "gl": "GB", "hl": "en-GB", "ceid": "GB:en"},
    "ca": {"country": "ca", "gl": "CA", "hl": "en-CA", "ceid": "CA:en"},
}

def get_locale(country):
    """
    Returns the locale parameters for a given country code.
    Defaults to 'us' if the country is not found.
    """
    return LOCALES.get(country.lower(), LOCALES["us"])
