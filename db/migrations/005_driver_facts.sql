CREATE TABLE driver_facts (
    driver_number INTEGER PRIMARY KEY,
    full_name TEXT NOT NULL,
    nationality TEXT NOT NULL,
    date_of_birth TEXT NOT NULL,
    place_of_birth TEXT NOT NULL,
    debut_season INTEGER NOT NULL,
    junior_career_highlight TEXT NOT NULL,
    fact_headline TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO driver_facts (driver_number, full_name, nationality, date_of_birth, place_of_birth, debut_season, junior_career_highlight, fact_headline) VALUES
    (1, 'Lando Norris', 'British', '1999-11-13', 'Bristol, England', 2019, '2017 FIA Formula 3 European Championship runner-up and McLaren junior graduate.', 'Built his reputation on elite one-lap pace before becoming McLaren''s long-term team leader.'),
    (3, 'Max Verstappen', 'Dutch', '1997-09-30', 'Hasselt, Belgium', 2015, 'Became the youngest Formula One race winner at the 2016 Spanish Grand Prix.', 'His aggressive, high-commitment style made him the benchmark for modern ground-effect-era qualifying laps.'),
    (5, 'Gabriel Bortoleto', 'Brazilian', '2004-10-14', 'Osasco, Sao Paulo, Brazil', 2025, 'Won the FIA Formula 3 and FIA Formula 2 titles in consecutive seasons in 2023 and 2024.', 'A Fernando Alonso protege who arrived in F1 after one of the cleanest junior-category title runs of the decade.'),
    (6, 'Isack Hadjar', 'French', '2004-09-28', 'Paris, France', 2025, 'Finished runner-up in the 2024 FIA Formula 2 Championship after four feature-race wins.', 'Nicknamed le Petit Prost in French media for his sharp racecraft and polished junior-formula performances.'),
    (10, 'Pierre Gasly', 'French', '1996-02-07', 'Rouen, France', 2017, 'Won the 2016 GP2 Series title before stepping into Formula One.', 'Gasly rebuilt his career after an early Red Bull promotion by turning AlphaTauri into a regular points threat.'),
    (11, 'Sergio Perez', 'Mexican', '1990-01-26', 'Guadalajara, Jalisco, Mexico', 2011, 'Claimed multiple GP2 victories before becoming Formula One''s leading modern Mexican scorer.', 'He became one of the grid''s defining tyre-management specialists and a reference point in long-stint race pace.'),
    (12, 'Kimi Antonelli', 'Italian', '2006-08-25', 'Bologna, Emilia-Romagna, Italy', 2025, 'Won the 2022 Italian F4 and ADAC Formula 4 titles plus both major Formula Regional titles in 2023.', 'Mercedes fast-tracked Antonelli after a junior career built on rapid adaptation across every step below F1.'),
    (14, 'Fernando Alonso', 'Spanish', '1981-07-29', 'Oviedo, Asturias, Spain', 2001, 'Two-time Formula One World Champion with titles in 2005 and 2006.', 'Alonso remains one of the sport''s clearest examples of racecraft, strategic feel, and longevity.'),
    (16, 'Charles Leclerc', 'Monegasque', '1997-10-16', 'Monte Carlo, Monaco', 2018, 'Won the 2017 FIA Formula 2 Championship in his rookie season.', 'Leclerc''s blend of braking commitment and low-speed traction makes him one of the grid''s most naturally explosive qualifiers.'),
    (18, 'Lance Stroll', 'Canadian', '1998-10-29', 'Montreal, Quebec, Canada', 2017, 'Won the 2016 FIA Formula 3 European Championship with Prema.', 'Stroll reached Formula One after a heavily managed junior climb built around strong wet-weather confidence.'),
    (23, 'Alexander Albon', 'Thai', '1996-03-23', 'London, England', 2019, 'Finished third in the 2018 FIA Formula 2 Championship after a late title push.', 'Albon rebuilt his F1 reputation by turning Williams'' midfield car into a consistent points challenger.'),
    (27, 'Nico Hulkenberg', 'German', '1987-08-19', 'Emmerich am Rhein, Germany', 2010, 'Won the 2009 GP2 Series title in his rookie season.', 'Long before his F1 comeback, Hulkenberg was already known for combining technical feedback with relentless consistency.'),
    (30, 'Liam Lawson', 'New Zealander', '2002-02-11', 'Hastings, New Zealand', 2023, 'Won the 2019 Toyota Racing Series title and finished runner-up in 2023 Super Formula.', 'Lawson reached Formula One through Red Bull''s reserve pipeline after proving he could adapt quickly in every substitute role.'),
    (31, 'Esteban Ocon', 'French', '1996-09-17', 'Evreux, France', 2016, 'Won the 2014 FIA Formula 3 European Championship and the 2015 GP3 Series title.', 'Ocon''s career has been defined by direct wheel-to-wheel aggression and resilience after multiple team changes.'),
    (41, 'Arvid Lindblad', 'British', '2007-08-08', 'Virginia Water, Surrey, England', 2026, 'Won the 2025 Formula Regional Oceania Championship and became the youngest Formula 2 race winner in 2025.', 'Lindblad arrived as one of Red Bull''s most heavily backed prospects, with Swedish and Indian family roots alongside British nationality.'),
    (43, 'Franco Colapinto', 'Argentine', '2003-05-27', 'Pilar, Buenos Aires, Argentina', 2024, 'Won the 2019 F4 Spanish Championship before moving through endurance racing, FIA F3, and FIA F2.', 'His Williams debut made him the first Argentine Formula One driver in more than two decades.'),
    (44, 'Lewis Hamilton', 'British', '1985-01-07', 'Stevenage, England', 2007, 'Seven-time Formula One World Champion and the most statistically successful driver in series history.', 'Hamilton combined qualifying speed, wet-weather control, and relentless race management into a record-setting career arc.'),
    (55, 'Carlos Sainz', 'Spanish', '1994-09-01', 'Madrid, Spain', 2015, 'Won the 2014 Formula Renault 3.5 Series title.', 'Sainz built his top-team reputation on analytical setup work and a smooth, low-error race style.'),
    (63, 'George Russell', 'British', '1998-02-15', 'King''s Lynn, England', 2019, 'Won GP3 in 2017 and FIA Formula 2 in 2018 in back-to-back rookie campaigns.', 'Russell''s rise was built on relentless qualifying efficiency and detailed technical feedback.'),
    (77, 'Valtteri Bottas', 'Finnish', '1989-08-28', 'Nastola, Finland', 2013, 'Won the 2011 GP3 Series title and multiple Formula Renault titles before Formula One.', 'Bottas is known for clean qualifying execution and one of the smoothest steering styles on the grid.'),
    (81, 'Oscar Piastri', 'Australian', '2001-04-06', 'Melbourne, Victoria, Australia', 2023, 'Won Formula Renault Eurocup, FIA Formula 3, and FIA Formula 2 in three straight seasons.', 'Piastri''s junior ladder is one of the strongest ever assembled by a driver entering Formula One.'),
    (87, 'Oliver Bearman', 'British', '2005-05-08', 'Chelmsford, England', 2024, 'Won both the Italian and ADAC Formula 4 titles in 2021.', 'Bearman''s early F1 opportunities accelerated after proving he could jump into unfamiliar machinery with minimal preparation.')
ON CONFLICT (driver_number) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    nationality = EXCLUDED.nationality,
    date_of_birth = EXCLUDED.date_of_birth,
    place_of_birth = EXCLUDED.place_of_birth,
    debut_season = EXCLUDED.debut_season,
    junior_career_highlight = EXCLUDED.junior_career_highlight,
    fact_headline = EXCLUDED.fact_headline,
    updated_at = NOW();